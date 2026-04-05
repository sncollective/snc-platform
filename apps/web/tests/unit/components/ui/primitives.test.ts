import { describe, it, expect } from "vitest";

describe("ui primitive exports", () => {
  it("dialog exports all expected members", async () => {
    const mod = await import("../../../../src/components/ui/dialog.js");
    expect(mod.DialogRoot).toBeDefined();
    expect(mod.DialogBackdrop).toBeDefined();
    expect(mod.DialogContent).toBeDefined();
    expect(mod.DialogTitle).toBeDefined();
    expect(mod.DialogDescription).toBeDefined();
    expect(mod.DialogCloseTrigger).toBeDefined();
    expect(mod.DialogTrigger).toBeDefined();
  });

  it("toast exports toaster singleton and provider", async () => {
    const mod = await import("../../../../src/components/ui/toast.js");
    expect(mod.toaster).toBeDefined();
    expect(mod.ToastProvider).toBeDefined();
    expect(typeof mod.toaster.success).toBe("function");
    expect(typeof mod.toaster.error).toBe("function");
  });

  it("tooltip exports Tooltip component", async () => {
    const mod = await import("../../../../src/components/ui/tooltip.js");
    expect(mod.Tooltip).toBeDefined();
  });

  it("menu exports all expected members", async () => {
    const mod = await import("../../../../src/components/ui/menu.js");
    expect(mod.MenuRoot).toBeDefined();
    expect(mod.MenuTrigger).toBeDefined();
    expect(mod.MenuContent).toBeDefined();
    expect(mod.MenuItem).toBeDefined();
    expect(mod.MenuSeparator).toBeDefined();
    expect(mod.MenuItemGroup).toBeDefined();
    expect(mod.MenuItemGroupLabel).toBeDefined();
  });

  it("tabs exports all expected members", async () => {
    const mod = await import("../../../../src/components/ui/tabs.js");
    expect(mod.TabsRoot).toBeDefined();
    expect(mod.TabsList).toBeDefined();
    expect(mod.TabsTrigger).toBeDefined();
    expect(mod.TabsContent).toBeDefined();
    expect(mod.TabsIndicator).toBeDefined();
  });

  it("select exports all expected members", async () => {
    const mod = await import("../../../../src/components/ui/select.js");
    expect(mod.SelectRoot).toBeDefined();
    expect(mod.SelectTrigger).toBeDefined();
    expect(mod.SelectContent).toBeDefined();
    expect(mod.SelectItem).toBeDefined();
    expect(mod.SelectItemText).toBeDefined();
    expect(mod.SelectItemIndicator).toBeDefined();
    expect(mod.SelectHiddenSelect).toBeDefined();
    expect(mod.createListCollection).toBeDefined();
  });

  it("popover exports all expected members", async () => {
    const mod = await import("../../../../src/components/ui/popover.js");
    expect(mod.PopoverRoot).toBeDefined();
    expect(mod.PopoverTrigger).toBeDefined();
    expect(mod.PopoverContent).toBeDefined();
    expect(mod.PopoverTitle).toBeDefined();
    expect(mod.PopoverDescription).toBeDefined();
    expect(mod.PopoverCloseTrigger).toBeDefined();
    expect(mod.PopoverAnchor).toBeDefined();
  });

  it("field exports all expected members", async () => {
    const mod = await import("../../../../src/components/ui/field.js");
    expect(mod.FieldRoot).toBeDefined();
    expect(mod.FieldLabel).toBeDefined();
    expect(mod.FieldInput).toBeDefined();
    expect(mod.FieldTextarea).toBeDefined();
    expect(mod.FieldSelect).toBeDefined();
    expect(mod.FieldHelperText).toBeDefined();
    expect(mod.FieldErrorText).toBeDefined();
    expect(mod.FieldRequiredIndicator).toBeDefined();
  });

  it("checkbox exports Checkbox component", async () => {
    const mod = await import("../../../../src/components/ui/checkbox.js");
    expect(mod.Checkbox).toBeDefined();
  });

  it("switch exports Switch component", async () => {
    const mod = await import("../../../../src/components/ui/switch.js");
    expect(mod.Switch).toBeDefined();
  });

  it("progress exports all expected members", async () => {
    const mod = await import("../../../../src/components/ui/progress.js");
    expect(mod.ProgressRoot).toBeDefined();
    expect(mod.ProgressLabel).toBeDefined();
    expect(mod.ProgressValueText).toBeDefined();
    expect(mod.ProgressTrack).toBeDefined();
    expect(mod.ProgressRange).toBeDefined();
  });

  it("collapsible exports all expected members", async () => {
    const mod = await import("../../../../src/components/ui/collapsible.js");
    expect(mod.CollapsibleRoot).toBeDefined();
    expect(mod.CollapsibleTrigger).toBeDefined();
    expect(mod.CollapsibleContent).toBeDefined();
    expect(mod.CollapsibleIndicator).toBeDefined();
  });
});
