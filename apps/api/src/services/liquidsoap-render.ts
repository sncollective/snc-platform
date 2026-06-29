import { BROADCAST_INPUT_SWITCH_PATH } from "./playout-topology.js";
import type {
  EnvRef,
  PlayoutChannelTopology,
  PlayoutEditorialTier,
  PlayoutTopology,
} from "./playout-topology.js";

// ── Private Helpers ──

/** Escape a string for use in Liquidsoap string literals. */
const escLiq = (s: string): string => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/** Render a runtime env reference as a Liquidsoap environment.get expression. */
const envGet = (ref: EnvRef): string =>
  `environment.get("${ref.envVar}", default="${escLiq(ref.default)}")`;

/**
 * Render the Liquidsoap source variable declarations for a single editorial tier.
 *
 * Returns an array of variable names that represent this tier's source(s) — for use
 * in the switch predicate list — and a block of Liquidsoap declarations to emit.
 *
 * The `queue` tier is the unified program source: it emits BOTH `${vid}_queue`
 * (operator request.queue) AND `${vid}_pool` (request.dynamic pool auto-fill), then
 * combines them as `${vid}_queue_program = fallback(track_sensitive=true, [queue, pool])`.
 * The `${vid}_queue_program` var is what participates in the readiness fallback switch.
 *
 * `${vid}_pool` is a `request.dynamic` that fetches the next least-recently-played
 * item by calling `/api/playout/channels/{id}/pool/next?secret=...` (implemented by
 * the control-service story). Until that endpoint exists, the pool source is not-ready
 * and the fallback falls through to silence — safe startup behavior.
 */
const renderTierSource = (
  t: PlayoutTopology,
  ch: PlayoutChannelTopology,
  tier: PlayoutEditorialTier,
  _tierIndex: number,
): { varName: string; declaration: string } | null => {
  const vid = ch.liqVar;
  switch (tier.type) {
    case "queue": {
      // Unified program source: operator queue + pool auto-fill.
      // ${vid}_queue = the operator's push queue (on_metadata webhook fires here
      //   for track-event POSTs + the /queue push + /skip endpoints target this).
      // ${vid}_pool = request.dynamic → fetches next LRP item from pool/next endpoint.
      //   Until the control-service endpoint exists, the dynamic returns null (not-ready)
      //   and the inner fallback silently skips to blank — correct startup behavior.
      // ${vid}_queue_program = fallback(track_sensitive=true, [queue, pool]):
      //   operator queue plays track-by-track; when empty, pool auto-fills.
      //   track_sensitive=true: a freshly-queued item is taken at the next track boundary
      //   ("switch over when ready" — the arm/take model).
      const queueVar = `${vid}_queue`;
      const poolVar = `${vid}_pool`;
      const programVar = `${vid}_queue_program`;
      const poolNextUrl = `http://\#{api_host}:\#{api_port}/api/playout/channels/${ch.id}/pool/next?secret=\#{callback_secret}`;
      const decls = [
        `${queueVar} = request.queue(id="${tier.queueId}")`,
        `${poolVar} = request.dynamic(fun() -> begin`,
        `  uri = http.get("${poolNextUrl}")`,
        `  if uri == "" then null() else request.create(uri) end`,
        `end)`,
        `${programVar} = fallback(track_sensitive=true, [${queueVar}, ${poolVar}])`,
      ].join("\n");
      return { varName: programVar, declaration: decls };
    }
    case "live": {
      // The broadcast channel (S/NC TV) owns the single :1936 live input — every creator
      // who "goes live on S/NC TV" pushes to it. So for the broadcast role the live tier
      // renders the real input.rtmp listener as the highest-priority fallback source.
      if (ch.role === "broadcast") {
        const liveVar = `${vid}_live`;
        return {
          varName: liveVar,
          declaration: `${liveVar} = input.rtmp(listen=true, "rtmp://0.0.0.0:${t.broadcastInputPort}/live/stream")`,
        };
      }
      // I2 — per-channel live tier deferred: a second input.rtmp(listen=true, …:1936/…) on a
      // non-broadcast channel collides with the broadcast listener → engine fails to start.
      // Per-channel RTMP ingest (SRS on_forward into one Liquidsoap input) is undesigned for
      // MVP. Skip live tiers; a channel left with no other enabled tiers falls to the
      // mksafe(blank()) tail. Revisit when per-channel ingest is scoped.
      return null;
    }
    case "channel-as-source": {
      // The referenced channel's _source variable — already defined earlier in the file
      // thanks to topological ordering enforced by buildPlayoutTopology.
      // No new declaration needed; just reference the existing variable.
      return {
        varName: tier.sourceLiqVar,
        declaration: "",
      };
    }
  }
};

/**
 * Render the Liquidsoap switch() expression for a channel's editorial tiers.
 *
 * AUTO mode: readiness fallback — all-true predicates in config order, highest priority
 * first. The queue tier additionally gates on `${vid}_armed()` so you can build the
 * queue while another source airs, then arm/take. The switch is:
 *   switch(track_sensitive=false, [
 *     ({ armed() }, queue_program),    # queue tier: armed gate
 *     ({ true }, carry_source),        # carry tiers: always-ready predicate
 *     ({ true }, mksafe(blank()))      # infallible tail
 *   ])
 * This is a readiness fallback: the first READY (available) source wins. The queue
 * participates when armed; carry participates when the upstream channel has content.
 * The mksafe tail ensures the switch never has zero ready children.
 *
 * MANUAL mode (render-time-static, B1 downgrade 2026-06-17): the switch shape is baked
 * from persisted config at render time. A single-case switch pins the tier at
 * manualTierIndex in the rendered-tier list, then the mksafe tail. There are no live
 * mode/manual refs — mode and manual-pin changes apply via regenerate-and-restart.
 *
 * `renderedTiers` must be the filtered list of tiers that produced `tierVarNames`
 * (live tiers are excluded — see I2 in renderChannelBlock). The two arrays are
 * parallel: renderedTiers[i] corresponds to tierVarNames[i].
 *
 * Rejected: a live `priority` ref — "auto" with a priority ref conflates auto-selection
 * with manual selection and isn't self-running. The readiness fallback is self-running
 * by design (the unified editorial model, 2026-06-17).
 */
const renderSwitchPredicates = (
  ch: PlayoutChannelTopology,
  tierVarNames: string[],
  renderedTiers: readonly PlayoutEditorialTier[],
): string => {
  const vid = ch.liqVar;

  if (ch.mode === "manual" && ch.manualTierIndex !== null) {
    const idx = ch.manualTierIndex;
    const pinnedVar = tierVarNames[idx] ?? "mksafe(blank())";
    const cases = [
      `  ({ true }, ${pinnedVar})`,
      `  ({ true }, mksafe(blank()))`,
    ];
    return `switch(track_sensitive=false, [\n${cases.join(",\n")}\n])`;
  }

  // AUTO mode: readiness fallback (all-true predicates = fallback semantics).
  // The queue tier gates additionally on armed so it can be built while another
  // source airs, then taken at the next track boundary.
  // Uses renderedTiers (live tiers excluded per I2) rather than ch.tiers.
  const cases = renderedTiers.map((tier, idx) => {
    const varName = tierVarNames[idx] ?? "mksafe(blank())";
    if (tier.type === "queue") {
      // Queue tier: participates only when armed
      return `  ({ ${vid}_armed() }, ${varName})`;
    }
    // channel-as-source: always-ready predicate (readiness fallback)
    return `  ({ true }, ${varName})`;
  });
  cases.push(`  ({ true }, mksafe(blank()))`);
  return `switch(track_sensitive=false, [\n${cases.join(",\n")}\n])`;
};

/**
 * Render the broadcast channel's source as a `fallback(transitions=[…])`.
 *
 * The broadcast channel (S/NC TV) is pure-auto with always-ready/armed sources, so a plain
 * priority `fallback` IS the readiness semantics — and `fallback`'s `transitions` parameter
 * carries the source-switch telemetry (`notify_switch`) that the live-state spine consumes.
 * This is byte-equivalent to the prior static S/NC TV block.
 *
 * Transition names are constrained to the input-switch route's enum
 * (`["live","queue","fallback","blank"]`, in order): live tier → "live", queue tier → "queue",
 * channel-as-source → "fallback", and the infallible tail → "blank". `renderedTiers[i]`
 * corresponds to `tierVarNames[i]`.
 */
const renderBroadcastFallback = (tierVarNames: string[]): string => {
  // tierVarNames is in priority order: the broadcast config is [live, queue, channel-as-source],
  // and live participates for broadcast (not skipped). The transition name for each source
  // matches the static block + the input-switch enum.
  const transitionFor = (varName: string): string => {
    if (varName.endsWith("_live")) return "live";
    if (varName.endsWith("_queue_program")) return "queue";
    return "fallback"; // channel-as-source carry
  };
  const transitions = [
    ...tierVarNames.map((v) => `notify_switch("${transitionFor(v)}")`),
    `notify_switch("blank")`,
  ];
  const sources = [...tierVarNames, "mksafe(blank())"];
  return `fallback(track_sensitive=false,
  transitions=[${transitions.join(", ")}],
  [${sources.join(", ")}])`;
};

/** Render the Liquidsoap block for a single playout channel. */
const renderChannelBlock = (t: PlayoutTopology, ch: PlayoutChannelTopology): string => {
  const vid = ch.liqVar;

  // ── Tier source declarations ──
  // Collect declarations + variable names for each tier.
  // renderTierSource returns null for deferred tier types (live tiers — I2).
  // Null results are skipped; they do not participate in the switch predicate list.
  const tierDeclarations: string[] = [];
  const tierVarNames: string[] = [];
  const renderedTiers: typeof ch.tiers[number][] = [];
  for (let i = 0; i < ch.tiers.length; i++) {
    const tier = ch.tiers[i]!;
    const rendered = renderTierSource(t, ch, tier, i);
    if (rendered === null) continue; // deferred tier type — skip
    if (rendered.declaration !== "") tierDeclarations.push(rendered.declaration);
    tierVarNames.push(rendered.varName);
    renderedTiers.push(tier);
  }

  // ── Queue tier detection ──
  // Find the queue tier's _queue variable name for the on_metadata track-event webhook.
  // The queue tier renders as ${vid}_queue_program (the combined fallback), but the
  // on_metadata hook attaches to ${vid}_queue (the operator request.queue) so that
  // track events fire on operator-curated pushes.
  const queueTierIdx = renderedTiers.findIndex((tier) => tier.type === "queue");
  const queueWebhookVarName = queueTierIdx >= 0 ? `${vid}_queue` : null;

  // For a queue-only default channel (no explicit config → single queue tier at index 0),
  // initialize armed=true so the queue participates in the readiness fallback immediately —
  // behaviorally equivalent to the prior fallback([queue, blank]) default.
  // If the channel has multiple tiers (e.g. carry + queue), start unarmed — the operator
  // explicitly arms the queue when they want it to take over.
  const initialArmed = renderedTiers.length === 1 && renderedTiers[0]?.type === "queue" ? "true" : "false";

  // ── Control refs ──
  // Only ${vid}_armed is a live-mutable ref (arm/take is the one live verb).
  // mode and manual-pin are render-time-static (B1 downgrade, 2026-06-17):
  //   the switch shape is baked at render time from persisted config; mode/manual
  //   changes apply via regenerate-and-restart. No ${vid}_mode / ${vid}_manual refs
  //   are emitted — they were declared before but never read by any switch predicate,
  //   making them dead + misleading. Removed here.

  // ── Source expression ──
  // The broadcast channel (S/NC TV) renders its source as a fallback(transitions=[…]) so the
  // source-switch telemetry (notify_switch → the live-state spine) rides on fallback's
  // transitions parameter — byte-equivalent to the prior static block. Its config is pure-auto
  // where every source is always-ready or armed, so a plain priority fallback IS the readiness
  // semantics. Playout channels render the generic switch() readiness fallback.
  const isBroadcast = ch.role === "broadcast";
  const sourceExpr = isBroadcast
    ? renderBroadcastFallback(tierVarNames)
    : renderSwitchPredicates(ch, tierVarNames, renderedTiers);

  // notify_switch def (broadcast only): one transition per fallback child, posting the
  // selected source name to the input-switch webhook so the live-state holder stays current.
  const notifySwitchDef = isBroadcast
    ? `
# Input-switch telemetry: one transition per source, same order as the fallback list.
# Each transition posts the source name to the API so the live-state holder stays current.
# SPIKE NOTE: fallback(transitions=[...]) firing semantics in Liquidsoap 2.4 must be
# validated in the dev container before relying on these in production. The fallback plan
# (a thread.run is_ready() poller) is documented in bold-event-spine-publishers.
def notify_switch(name) =
  fun (_, b) -> begin
    ignore(http.post(
      headers=[("Content-Type", "application/json")],
      data='{"source":"#{name}"}',
      "http://#{api_host}:#{api_port}${BROADCAST_INPUT_SWITCH_PATH}?secret=#{callback_secret}"
    ))
    b
  end
end
`
    : "";

  // ── Now-playing reads switch.selected() ──
  // Uses switch.selected() — NOT on_metadata — per position gotcha #1. on_metadata is
  // blind to mid-track re-selection; .selected() is the authoritative current-child query.
  // Returns a source-id label string (JSON-serializable; NOT the raw source object which
  // res.json cannot serialize) plus elapsed/remaining for UI progress tracking.

  // Queue webhook block (only emitted if a queue tier exists — attaches to ${vid}_queue,
  // NOT ${vid}_queue_program, so the track-event webhook fires on operator-curated content only).
  //
  // For a PLAYOUT channel this block also writes ${vid}_uri / ${vid}_title (its now-playing refs) —
  // correct there because the playout source is the queue program; its airing track == its queue
  // metadata.
  //
  // For the BROADCAST channel the queue is only one of several sources (live / queue / carry), and
  // the dominant airing state is the carried channel — so the now-playing refs must NOT be sourced
  // from the queue alone (BLOCKER 1: they'd stay "" whenever a non-queue source airs). The broadcast
  // case therefore only POSTs the track-event from the queue webhook (operator content), and the
  // now-playing refs are written by a separate ${vid}_source.on_metadata below (any aired source).
  const queueWebhookBlock = queueWebhookVarName
    ? isBroadcast
      ? `
${queueWebhookVarName}.on_metadata(synchronous=false, fun(m) -> begin
  u = m["s3_uri"]
  q_uri = if u == "" then m["filename"] else u end
  ignore(http.post(
    headers=[("Content-Type", "application/json")],
    data='{"uri":"#{q_uri}","title":"#{m["title"]}"}',
    "http://#{api_host}:#{api_port}${ch.trackEventPath}?secret=#{callback_secret}"
  ))
end)`
      : `
${queueWebhookVarName}.on_metadata(synchronous=false, fun(m) -> begin
  u = m["s3_uri"]
  ${vid}_uri := if u == "" then m["filename"] else u end
  ${vid}_title := m["title"]
  ignore(http.post(
    headers=[("Content-Type", "application/json")],
    data='{"uri":"#{${vid}_uri()}","title":"#{${vid}_title()}"}',
    "http://#{api_host}:#{api_port}${ch.trackEventPath}?secret=#{callback_secret}"
  ))
end)`
    : "";

  // Broadcast-only: the now-playing refs track whatever source the fallback is airing — live,
  // queue, OR the carried channel — restoring the old static block's whole-fallback on_metadata.
  // (Playout channels write these refs from the queue webhook above; their now-playing IS the queue.)
  const broadcastNowPlayingBlock = isBroadcast
    ? `
${vid}_source.on_metadata(synchronous=false, fun(m) -> begin
  u = m["s3_uri"]
  ${vid}_uri := if u == "" then m["filename"] else u end
  ${vid}_title := m["title"]
end)`
    : "";

  // The arm verb gates the queue tier in a playout channel's switch(). The broadcast fallback
  // lists its sources unconditionally (no armed predicate — matching the old static block's
  // always-on snc_tv_queue), so neither the ${vid}_armed ref nor the /arm endpoint is meaningful
  // for broadcast — emit them for playout channels only (avoids a live-but-inert control surface).
  const armedRefDecl = isBroadcast ? "" : `\n${vid}_armed = ref(${initialArmed})`;
  const armEndpointBlock = isBroadcast
    ? ""
    : `

harbor.http.register(port=${t.harborPort}, method="POST", "${ch.harborPaths.arm}", fun(req, res) -> begin
  secret = environment.get("PLAYOUT_CALLBACK_SECRET", default="")
  q = req.query
  if q["secret"] == secret and secret != "" then
    ${vid}_armed := req.body() == "true"
    res.data("ok")
  else
    res.status_code(401)
    res.data("unauthorized")
  end
end)`;

  return `
# ── Channel: ${escLiq(ch.name)} (${isBroadcast ? "broadcast" : "playout"}) ──

${tierDeclarations.join("\n")}
${armedRefDecl}
${notifySwitchDef}
${vid}_source = ${sourceExpr}

${vid}_uri = ref("")
${vid}_title = ref("")${queueWebhookBlock}${broadcastNowPlayingBlock}

output.url(url="rtmp://#{srs_host}:${t.srsRtmpPort}/live/${escLiq(ch.srsStreamName)}?key=#{playout_key}", enc, ${vid}_source)

harbor.http.register(port=${t.harborPort}, method="POST", "${ch.harborPaths.queue}", fun(req, res) -> begin
  secret = environment.get("PLAYOUT_CALLBACK_SECRET", default="")
  q = req.query
  if q["secret"] == secret and secret != "" then
    ${queueWebhookVarName ?? `${vid}_queue`}.push.uri(req.body())
    res.data("queued")
  else
    res.status_code(401)
    res.data("unauthorized")
  end
end)

harbor.http.register(port=${t.harborPort}, method="POST", "${ch.harborPaths.skip}", fun(req, res) -> begin
  secret = environment.get("PLAYOUT_CALLBACK_SECRET", default="")
  q = req.query
  if q["secret"] == secret and secret != "" then
    ${vid}_source.skip()
    res.data("skipped")
  else
    res.status_code(401)
    res.data("unauthorized")
  end
end)

harbor.http.register(port=${t.harborPort}, method="GET", "${ch.harborPaths.nowPlaying}", fun(_req, res) -> begin
  e = ${vid}_source.elapsed()
  r = ${vid}_source.remaining()
  safe_elapsed = if e == infinity or e != e then -1. else e end
  safe_remaining = if r == infinity or r != r then -1. else r end
  selected_id = begin
    s = ${vid}_source.selected()
    if null.defined(s) then source.id(null.get(s)) else "(none)" end
  end
  res.json({
    uri = ${vid}_uri(),
    title = ${vid}_title(),
    elapsed = safe_elapsed,
    remaining = safe_remaining,
    selected = selected_id
  })
end)${armEndpointBlock}
`;
};

// ── Public API ──

/**
 * Render the full playout.liq content from a topology document. Pure — the
 * topology is the only input; byte-identical output for identical topologies.
 *
 * Runtime values (stream key, hosts, secrets) render as environment.get
 * references resolved by Liquidsoap in its own container, never here.
 */
export const renderPlayoutLiq = (t: PlayoutTopology): string => {
  const channelBlocks = t.channels.map((ch) => renderChannelBlock(t, ch)).join("\n");

  return `# ── Auto-generated by S/NC Platform ──
# Do not edit manually — regenerated on channel create/delete.
# Static sections (logging, S3, encoding, health, S/NC TV) are preserved.

# ── Logging ──

log.stdout := true
log.file := false
log.level := 4

# ── S3 Protocol (Garage) ──

settings.protocol.aws.endpoint := ${envGet(t.env.awsEndpoint)}
settings.protocol.aws.region := ${envGet(t.env.awsRegion)}

# ── Config ──

playout_key = ${envGet(t.env.playoutKey)}
srs_host = ${envGet(t.env.srsHost)}
api_host = ${envGet(t.env.apiHost)}
api_port = ${envGet(t.env.apiPort)}
callback_secret = ${envGet(t.env.callbackSecret)}

# ── Encoding ──

enc = %ffmpeg(
  format="flv",
  %video(codec="libx264", preset="ultrafast", b="2500k", g="60"),
  %audio(codec="aac", b="256k")
)

settings.harbor.bind_addrs := ["0.0.0.0"]

# ── Health Check ──

harbor.http.register(port=${t.harborPort}, method="GET", "/health", fun(_req, res) -> begin
  res.data("ok")
end)

# ── Admin Control ──

harbor.http.register(port=${t.harborPort}, method="POST", "/admin/shutdown", fun(req, res) -> begin
  secret = ${envGet(t.env.callbackSecret)}
  q = req.query
  if q["secret"] == secret and secret != "" then
    res.data("shutting down")
    shutdown()
  else
    res.status_code(401)
    res.data("unauthorized")
  end
end)

# ── Channels (generated from database — playout + S/NC TV broadcast) ──
${channelBlocks}`;
};
