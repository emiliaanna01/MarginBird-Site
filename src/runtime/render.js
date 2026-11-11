// Renders compiled .dc templates with Preact. Shared by the Node prerender and the browser.
// Template node shapes: [0, text] | [1, tag, attrs[[k,v]], children] | [2, 'for', listExpr, asName, children]
//                       [3, valueExpr, children] (if) | [4, name, attrs] (import)

const BOOL = new Set(['required', 'disabled', 'checked', 'async', 'defer', 'hidden', 'novalidate', 'autofocus', 'multiple', 'selected', 'readonly', 'open']);
const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
const WHOLE = /^\{\{\s*([^}]+?)\s*\}\}$/;

function lookup(path, scopes) {
  if (path === 'true') return true;
  if (path === 'false') return false;
  if (path === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
  if (/^(['"]).*\1$/.test(path)) return path.slice(1, -1);
  const parts = path.split('.');
  for (let i = scopes.length - 1; i >= 0; i--) {
    const s = scopes[i];
    if (s && Object.prototype.hasOwnProperty.call(s, parts[0])) {
      let v = s[parts[0]];
      for (let k = 1; k < parts.length; k++) v = v == null ? undefined : v[parts[k]];
      return v;
    }
  }
  return undefined;
}

function value(raw, scopes) {
  const m = WHOLE.exec(raw);
  if (m) return lookup(m[1], scopes);
  if (raw.indexOf('{{') < 0) return raw;
  return raw.replace(HOLE, (_, p) => { const v = lookup(p, scopes); return v == null ? '' : String(v); });
}

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const EVENTS = { onclick: 'onClick', onsubmit: 'onSubmit', onmousemove: 'onMouseMove', onmouseleave: 'onMouseLeave', onmouseenter: 'onMouseEnter', onfocus: 'onFocus', onblur: 'onBlur', oninput: 'onInput', onchange: 'onChange', onkeydown: 'onKeyDown', onpointermove: 'onPointerMove' };

export function createDC(h, Fragment, PComponent) {
  const registry = {};

  function renderNodes(nodes, scopes, out) {
    for (const n of nodes) {
      const k = n[0];
      if (k === 0) { out.push(value(n[1], scopes)); continue; }
      if (k === 1) {
        const props = {};
        for (const [name, raw] of n[2]) {
          if (name.startsWith('hint-')) continue;
          let v = value(raw, scopes);
          if (name === 'ref') { if (typeof v === 'function') props.ref = v; continue; }
          const ev = EVENTS[name];
          if (ev) { if (typeof v === 'function') props[ev] = v; continue; }
          if (BOOL.has(name) && v === '') v = true;
          if (v === undefined || v === null) continue;
          props[name] = v;
        }
        const kids = [];
        renderNodes(n[3], scopes, kids);
        out.push(h(n[1], props, ...kids));
        continue;
      }
      if (k === 2) {
        const list = lookup(n[1], scopes) || [];
        list.forEach((item, i) => {
          const kids = [];
          renderNodes(n[4], scopes.concat([{ [n[2]]: item, $index: i }]), kids);
          out.push(h(Fragment, { key: i }, ...kids));
        });
        continue;
      }
      if (k === 3) {
        if (lookup(n[1], scopes)) renderNodes(n[2], scopes, out);
        continue;
      }
      if (k === 4) {
        const C = registry[n[1]];
        if (!C) continue;
        const props = {};
        for (const [name, raw] of n[2]) { if (name.startsWith('hint-')) continue; props[camel(name)] = value(raw, scopes); }
        out.push(h(C, props));
      }
    }
    return out;
  }

  class DCLogic extends PComponent {
    render() {
      const vals = this.renderVals ? this.renderVals() : {};
      const kids = renderNodes(this.constructor.__tpl, [vals], []);
      return kids.length === 1 ? kids[0] : h(Fragment, null, ...kids);
    }
  }

  function define(name, tpl, factory) {
    const C = factory(DCLogic);
    C.__tpl = tpl;
    registry[name] = C;
    return C;
  }

  return { define, registry, DCLogic };
}
