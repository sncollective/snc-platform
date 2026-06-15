#!/usr/bin/env python3
"""Bridge the agent sandbox's isolated network namespace to host dev services.

WHY THIS EXISTS
---------------
Claude Code runs each Bash command in its own network namespace whose only
listeners are the egress proxies (SOCKS5 on 127.0.0.1:1080, HTTP on :3128). The
dev stack (Postgres, Garage, SRS, Liquidsoap, imgproxy, Mailpit) is published on
the host/base-namespace localhost — a DIFFERENT netns — so a sandboxed process
cannot reach `127.0.0.1:5432` directly (it gets ECONNREFUSED) even though the
services are healthy. A human developer never hits this: their interactive shell
runs in the base namespace where the services are directly reachable.

This script re-exposes the host services on the CURRENT netns's 127.0.0.1 (same
port number) by relaying each accepted connection through the SOCKS5 egress
proxy. It is pure userspace TCP plumbing: no privilege, no docker socket, no
chmod, nothing escalated. The docker socket stays at its default 660.

IMPORTANT: each Bash invocation gets a fresh netns, so this forwarder must run in
the SAME invocation as whatever needs the services (e.g. the integration test
runner). Launch it in the background, then run the test, then kill it — see
sandbox-test-integration.sh.

USAGE
-----
    python3 sandbox-forward.py 5432 3900 1025 ...      # forward these host ports

The SOCKS proxy is present in every sandbox netns, so the relay always has a path
out; only the destination ports vary.
"""
import select
import socket
import struct
import sys
import threading

SOCKS_PROXY = ("127.0.0.1", 1080)


def socks_connect(host: str, port: int) -> socket.socket:
    """Open a TCP connection to host:port through the SOCKS5 egress proxy."""
    s = socket.socket()
    s.settimeout(8)
    s.connect(SOCKS_PROXY)
    s.sendall(b"\x05\x01\x00")  # greeting: SOCKS5, 1 method, no-auth
    greeting = s.recv(2)
    if greeting[1:2] != b"\x00":
        raise OSError("socks5: no acceptable auth method")
    # CONNECT, IPv4 literal
    s.sendall(b"\x05\x01\x00\x01" + socket.inet_aton(host) + struct.pack(">H", port))
    reply = s.recv(10)
    if len(reply) < 2 or reply[1] != 0x00:
        raise OSError("socks5: connect refused rep=%s" % (reply[1] if len(reply) > 1 else "?"))
    s.settimeout(None)
    return s


def pump(a: socket.socket, b: socket.socket) -> None:
    """Relay bytes bidirectionally until either side closes."""
    try:
        while True:
            ready, _, _ = select.select([a, b], [], [])
            if a in ready:
                data = a.recv(65536)
                if not data:
                    break
                b.sendall(data)
            if b in ready:
                data = b.recv(65536)
                if not data:
                    break
                a.sendall(data)
    except OSError:
        pass
    finally:
        for s in (a, b):
            try:
                s.close()
            except OSError:
                pass


def handle(client: socket.socket, port: int) -> None:
    try:
        upstream = socks_connect("127.0.0.1", port)
    except OSError:
        client.close()
        return
    pump(client, upstream)


def _serve(srv: socket.socket, port: int) -> None:
    while True:
        client, _ = srv.accept()
        threading.Thread(target=handle, args=(client, port), daemon=True).start()


def listen(port: int) -> int:
    """Bind 127.0.0.1 and (best-effort) ::1 so `localhost` resolves either way.

    Returns the number of address families successfully bound.
    """
    bound = 0
    for family, addr in ((socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")):
        try:
            srv = socket.socket(family)
            srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            if family == socket.AF_INET6:
                srv.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 1)
            srv.bind((addr, port))
            srv.listen(128)
            threading.Thread(target=_serve, args=(srv, port), daemon=True).start()
            bound += 1
        except OSError:
            # ::1 is commonly unavailable in the sandbox netns — IPv4 alone is fine.
            pass
    return bound


def main() -> None:
    ports = [int(p) for p in sys.argv[1:]]
    if not ports:
        print("usage: sandbox-forward.py <port> [port ...]", file=sys.stderr)
        sys.exit(2)
    for port in ports:
        n = listen(port)
        if n:
            print("forward localhost:%d ->(socks)-> host 127.0.0.1:%d" % (port, port), flush=True)
        else:
            print("FAILED to bind localhost:%d" % port, file=sys.stderr, flush=True)
    print("sandbox-forward ready on %d port(s)" % len(ports), flush=True)
    threading.Event().wait()


if __name__ == "__main__":
    main()
