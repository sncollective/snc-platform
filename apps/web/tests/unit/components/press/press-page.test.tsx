import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PressPage } from "../../../../src/components/press/press-page.js";
import { makePressTemplateProps } from "../../../helpers/press-fixtures.js";

describe("PressPage template selector", () => {
  it.each(["A", "B"] as const)("renders only Template %s", (template) => {
    const props = makePressTemplateProps({ template });
    const { container } = render(<PressPage {...props} />);

    expect(container.querySelector(`[data-press-template="${template}"]`)).toBeInTheDocument();
    expect(container.querySelector(`[data-press-template="${template === "A" ? "B" : "A"}"]`)).not.toBeInTheDocument();
  });

  it("falls back to Template A for an unexpected runtime template value", () => {
    const props = makePressTemplateProps();
    const malformedProps = {
      ...props,
      content: { ...props.content, template: "unexpected" },
    } as unknown as typeof props;
    const { container } = render(<PressPage {...malformedProps} />);

    expect(container.querySelector('[data-press-template="A"]')).toBeInTheDocument();
    expect(container.querySelector('[data-press-template="B"]')).not.toBeInTheDocument();
  });
});
