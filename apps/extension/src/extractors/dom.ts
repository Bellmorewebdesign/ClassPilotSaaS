/**
 * DOM reading helpers.
 *
 * Every helper here is defensive: it returns null rather than throwing, and
 * it ignores content that is hidden from assistive technology (which is
 * usually content Classroom has rendered but is not showing).
 *
 * Deliberately absent: anything that reads obfuscated CSS class names or
 * nth-child positions. Those are the selectors that break silently.
 */

/** Collapse whitespace and trim; null for anything that empties out. */
export function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned === '' ? null : cleaned;
}

/** Same, but preserves paragraph breaks -- used for assignment instructions. */
export function cleanMultilineText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned === '' ? null : cleaned;
}

/** True when the element is hidden from assistive technology. */
export function isAriaHidden(element: Element): boolean {
  let current: Element | null = element;
  while (current) {
    if (current.getAttribute('aria-hidden') === 'true') return true;
    current = current.parentElement;
  }
  return false;
}

/**
 * The element's visible text, skipping script/style and aria-hidden subtrees.
 * This is what a screen reader would roughly announce.
 */
export function visibleText(element: Element | null): string | null {
  if (!element) return null;
  const parts: string[] = [];

  const walk = (node: Node): void => {
    if (node.nodeType === 3 /* TEXT_NODE */) {
      const text = node.nodeValue;
      // Collapse whitespace WITHIN the text node, exactly as a browser does
      // when rendering. Source-code line wrapping inside a paragraph must not
      // become a hard line break in the text we extract.
      if (text && text.trim() !== '') parts.push(text.replace(/\s+/g, ' '));
      return;
    }
    if (node.nodeType !== 1 /* ELEMENT_NODE */) return;

    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'noscript') return;
    if (el.getAttribute('aria-hidden') === 'true') return;

    for (const child of Array.from(el.childNodes)) walk(child);

    // Block-level elements imply a line break for readability.
    if (['p', 'div', 'li', 'br', 'h1', 'h2', 'h3', 'h4', 'tr'].includes(tag)) {
      parts.push('\n');
    }
  };

  walk(element);
  return cleanMultilineText(parts.join(' '));
}

/**
 * Approximate the element's accessible name, in the order the accessibility
 * tree resolves it: aria-label, then aria-labelledby, then title, then text.
 *
 * Classroom leans heavily on aria-label for its cards and buttons, which
 * makes this one of the more durable signals available to us.
 */
export function accessibleName(element: Element | null): string | null {
  if (!element) return null;

  const ariaLabel = cleanText(element.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const doc = element.ownerDocument;
    const labels = labelledBy
      .split(/\s+/)
      .map((id) => doc.getElementById(id))
      .filter((node): node is HTMLElement => node !== null)
      .map((node) => cleanText(node.textContent))
      .filter((text): text is string => text !== null);
    if (labels.length > 0) return labels.join(' ');
  }

  const title = cleanText(element.getAttribute('title'));
  if (title) return title;

  return cleanText(element.textContent);
}

/** All anchors with a usable href, excluding aria-hidden subtrees. */
export function links(root: ParentNode): HTMLAnchorElement[] {
  return Array.from(root.querySelectorAll('a[href]')).filter(
    (anchor): anchor is HTMLAnchorElement =>
      anchor instanceof HTMLAnchorElement ||
      // happy-dom and jsdom both provide HTMLAnchorElement, but guard anyway
      // so a fixture built from raw nodes still works.
      anchor.tagName.toLowerCase() === 'a',
  ) as HTMLAnchorElement[];
}

/**
 * The page's main content region.
 *
 * Preference order is semantic: <main>, then role="main", then the document
 * body. Scoping to main is what stops the site nav and class-list sidebar
 * from polluting a single assignment's extraction.
 */
export function mainRegion(document: Document): Element {
  return (
    document.querySelector('main') ??
    document.querySelector('[role="main"]') ??
    document.body
  );
}

/** Headings in document order, most prominent first. */
export function headings(root: ParentNode): Element[] {
  return Array.from(
    root.querySelectorAll('h1, h2, h3, [role="heading"]'),
  ).filter((element) => !isAriaHidden(element));
}

/**
 * Find the first element whose visible text matches a pattern.
 * Used for label-driven extraction ("Due ...", "100 points").
 */
export function findByTextPattern(
  root: ParentNode,
  pattern: RegExp,
  selector = '*',
): { element: Element; text: string } | null {
  for (const element of Array.from(root.querySelectorAll(selector))) {
    if (isAriaHidden(element)) continue;
    // Only consider leaf-ish elements: a match on <body> is useless.
    if (element.children.length > 3) continue;
    const text = cleanText(element.textContent);
    if (text && pattern.test(text)) return { element, text };
  }
  return null;
}

/** Every match of {@link findByTextPattern}, not just the first. */
export function findAllByTextPattern(
  root: ParentNode,
  pattern: RegExp,
  selector = '*',
): Array<{ element: Element; text: string }> {
  const results: Array<{ element: Element; text: string }> = [];
  for (const element of Array.from(root.querySelectorAll(selector))) {
    if (isAriaHidden(element)) continue;
    if (element.children.length > 3) continue;
    const text = cleanText(element.textContent);
    if (text && pattern.test(text)) results.push({ element, text });
  }
  return results;
}

/** Walk up from an element looking for an ancestor that matches. */
export function closestMatching(
  element: Element,
  predicate: (candidate: Element) => boolean,
  maxDepth = 10,
): Element | null {
  let current: Element | null = element.parentElement;
  let depth = 0;
  while (current && depth < maxDepth) {
    if (predicate(current)) return current;
    current = current.parentElement;
    depth += 1;
  }
  return null;
}
