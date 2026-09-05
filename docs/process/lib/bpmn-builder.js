/*
 * bpmn-builder.js — небольшой генератор BPMN 2.0 с готовой раскладкой.
 *
 * Модель описывается сеткой: дорожка + колонка + ряд внутри дорожки.
 * Генератор сам считает координаты, ломаные потоков, рамки групп
 * и проверяет, что линии не пересекают фигуры.
 */

const DEFAULTS = { colw: 180, rowh: 140, x0: 320, y0: 260, taskw: 138, taskh: 80 };

function createModel(cfg) {
  const C = Object.assign({}, DEFAULTS, cfg);
  const { colw: COLW, rowh: ROWH, x0: X0, y0: Y0, taskw: TW, taskh: TH } = C;
  const EVS = 36, GWS = 50, SUBW = 200, SUBH = 90, ANW = 158, ANH = 56;

  const TYPES = {
    start:   { tag: 'startEvent',             w: EVS, h: EVS },
    end:     { tag: 'endEvent',               w: EVS, h: EVS },
    timer:   { tag: 'intermediateCatchEvent', w: EVS, h: EVS, def: 'timerEventDefinition' },
    msgin:   { tag: 'intermediateCatchEvent', w: EVS, h: EVS, def: 'messageEventDefinition' },
    throw:   { tag: 'intermediateThrowEvent', w: EVS, h: EVS },
    user:    { tag: 'userTask',    w: TW, h: TH },
    service: { tag: 'serviceTask', w: TW, h: TH },
    send:    { tag: 'sendTask',    w: TW, h: TH },
    manual:  { tag: 'manualTask',  w: TW, h: TH },
    xor:     { tag: 'exclusiveGateway', w: GWS, h: GWS },
    sub:     { tag: 'subProcess', w: SUBW, h: SUBH, attrs: ' triggeredByEvent="true"' },
    boundary:{ tag: 'boundaryEvent', w: EVS, h: EVS, def: 'timerEventDefinition' },
    note:    { tag: 'textAnnotation', w: ANW, h: ANH },
    data:    { tag: 'dataObjectReference', w: 36, h: 50 },
  };

  const lanes = C.lanes.map(l => Object.assign({}, l));
  let ly = Y0;
  const laneById = {};
  for (const l of lanes) { l.y = ly; l.h = l.rows * ROWH; ly += l.h; laneById[l.id] = l; }
  const POOL = { x: 150, y: Y0, h: ly - Y0 };

  const nodes = [], byId = {}, flows = [], EXT = [], MSG = [], assoc = [], dataOut = [], groups = [];
  const subContent = {};

  function node(id, type, name, lane, col, row, opts = {}) {
    const t = TYPES[type], L = laneById[lane];
    if (!t) throw new Error('неизвестный тип узла: ' + type);
    if (!L) throw new Error('неизвестная дорожка: ' + lane);
    const n = { id, type, t, name, lane, col, row, w: opts.w || t.w, h: opts.h || t.h, dx: opts.dx || 0, doc: opts.doc,
                attachedTo: opts.attachedTo, side: opts.side || 'bottom' };
    place(n);
    nodes.push(n); byId[id] = n;
    return n;
  }
  function place(n) {
    if (n.attachedTo) { // граничное событие живёт на кромке своей задачи
      const host = byId[n.attachedTo];
      if (!host) throw new Error(`${n.id}: нет задачи ${n.attachedTo}`);
      n.cx = host.cx + n.dx;
      n.cy = n.side === 'top' ? host.y : host.y + host.h;
      n.x = Math.round(n.cx - n.w / 2); n.y = Math.round(n.cy - n.h / 2);
      return;
    }
    const L = laneById[n.lane];
    n.cx = X0 + n.col * COLW + TW / 2 + n.dx;
    n.cy = L.y + n.row * ROWH + ROWH / 2;
    n.x = Math.round(n.cx - n.w / 2); n.y = Math.round(n.cy - n.h / 2);
  }
  const recompute = () => nodes.forEach(place);

  function flow(src, tgt, name, route, opts = {}) {
    flows.push(Object.assign({ id: 'Flow_' + (flows.length + 1), src, tgt, name: name || '', route: route || 'auto' }, opts));
  }
  /* Явный XOR-шлюз слияния перед задачей: колонки правее сдвигаются на одну. */
  function insertMerge(mergeId, taskId) {
    const t = byId[taskId], col = t.col, lane = t.lane, row = t.row;
    nodes.forEach(n => { if (n.col >= col) n.col += 1; });
    recompute();
    node(mergeId, 'xor', '', lane, col, row);
    flows.forEach(f => { if (f.tgt === taskId) f.tgt = mergeId; });
    flow(mergeId, taskId, '', 'h');
  }
  const external = e => EXT.push(Object.assign({}, e));
  const message = m => MSG.push(Object.assign({}, m));
  const annotate = (src, note) => assoc.push([src, note]);
  const data = (src, obj) => dataOut.push([src, obj]);
  const group = (id, title, firstId, lastId) => groups.push([id, title, firstId, lastId]);
  const subprocess = (id, content) => { subContent[id] = content; };

  /* ---------- геометрия ---------- */
  const R = n => ({ x: n.x + n.w, y: Math.round(n.cy) });
  const Lp = n => ({ x: n.x, y: Math.round(n.cy) });
  const Tp = n => ({ x: Math.round(n.cx), y: n.y });
  const Bp = n => ({ x: Math.round(n.cx), y: n.y + n.h });

  function waypoints(f) {
    const s = byId[f.src], t = byId[f.tgt];
    if (!s || !t) throw new Error(`поток ${f.id}: нет узла ${!s ? f.src : f.tgt}`);
    const sameRow = Math.abs(s.cy - t.cy) < 2, fwd = t.cx > s.cx;
    const route = f.route === 'auto' ? (sameRow ? 'h' : 'hvh') : f.route;
    if (route === 'h') return fwd ? [R(s), Lp(t)] : [Lp(s), R(t)];
    if (route === 'hvh') {
      const a = fwd ? R(s) : Lp(s), b = fwd ? Lp(t) : R(t);
      const mx = f.mx || (Math.abs(t.col - s.col) === 1 ? Math.round((s.cx + t.cx) / 2) : Math.round((a.x + b.x) / 2));
      return [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b];
    }
    if (route === 'vh') {
      const down = t.cy > s.cy, a = down ? Bp(s) : Tp(s);
      if (Math.abs(s.cx - t.cx) < 2) return [a, down ? Tp(t) : Bp(t)];
      const b = t.cx > s.cx ? Lp(t) : R(t);
      return [a, { x: a.x, y: b.y }, b];
    }
    if (route === 'hv') {
      const a = t.cx > s.cx ? R(s) : Lp(s), down = t.cy > s.cy;
      const b = down ? Tp(t) : Bp(t);
      return [a, { x: b.x, y: a.y }, b];
    }
    throw new Error('неизвестный маршрут: ' + route);
  }
  const assocWaypoints = (s, a) => (a.cy > s.cy ? [Bp(s), Tp(a)] : [Tp(s), Bp(a)]);
  function msgWaypoints(m) {
    const ext = EXT.find(e => e.id === m.src || e.id === m.tgt);
    const n = byId[m.src] || byId[m.tgt], fromNode = !!byId[m.src], up = ext.side === 'top';
    const base = up ? Tp(n) : Bp(n);
    const p = { x: base.x + (m.dx || 0), y: base.y };
    const q = { x: p.x, y: up ? ext.y + ext.h : ext.y };
    return fromNode ? [p, q] : [q, p];
  }

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/\n/g, '&#10;');

  function build() {
    /* внешние пулы позиционируем по их якорям */
    for (const e of EXT) {
      const a = byId[e.anchor], b = byId[e.anchor2];
      e.x = Math.round(a.cx - 110);
      e.w = Math.round(b.cx - a.cx + 240);
      e.h = 60;
      e.y = e.side === 'top' ? POOL.y - 130 : POOL.y + POOL.h + 70;
    }

    /* ---------- проверка раскладки ---------- */
    const PAD = 5;
    const boxes = nodes.map(n => ({ id: n.id, x1: n.x - PAD, y1: n.y - PAD, x2: n.x + n.w + PAD, y2: n.y + n.h + PAD }));
    const problems = [];
    const hits = (p1, p2, b) => Math.max(p1.x, p2.x) >= b.x1 && Math.min(p1.x, p2.x) <= b.x2 &&
                                Math.max(p1.y, p2.y) >= b.y1 && Math.min(p1.y, p2.y) <= b.y2;
    const allEdges = flows.map(f => ({ id: f.id, src: f.src, tgt: f.tgt, wps: waypoints(f) }))
      .concat(MSG.map(m => ({ id: m.id, src: m.src, tgt: m.tgt, wps: msgWaypoints(m) })));
    for (const e of allEdges)
      for (let i = 0; i < e.wps.length - 1; i++)
        for (const b of boxes) {
          if (b.id === e.src || b.id === e.tgt) continue;
          if (byId[e.src] && byId[e.src].attachedTo === b.id) continue;
          if (byId[e.tgt] && byId[e.tgt].attachedTo === b.id) continue;
          if (hits(e.wps[i], e.wps[i + 1], b)) problems.push(`${e.id} (${e.src} → ${e.tgt}) задевает ${b.id}`);
        }
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (byId[a.id].attachedTo === b.id || byId[b.id].attachedTo === a.id) continue;
        if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) problems.push(`наложение: ${a.id} и ${b.id}`);
      }
    for (const g of groups) {
      const c1 = byId[g[2]].col, c2 = byId[g[3]].col;
      const gx1 = X0 + c1 * COLW - 21, gx2 = X0 + c2 * COLW + TW + 21;
      for (const n of nodes) for (const gx of [gx1, gx2])
        if (n.x - 4 < gx && gx < n.x + n.w + 4) problems.push(`рамка ${g[0]} рассекает ${n.id}`);
    }

    /* ---------- тело процесса ---------- */
    const incoming = {}, outgoing = {};
    for (const f of flows) {
      (outgoing[f.src] = outgoing[f.src] || []).push(f.id);
      (incoming[f.tgt] = incoming[f.tgt] || []).push(f.id);
    }
    const P = [];
    P.push('    <bpmn:laneSet id="LaneSet_1">');
    for (const l of lanes) {
      P.push(`      <bpmn:lane id="${l.id}" name="${esc(l.name)}">`);
      nodes.filter(n => n.lane === l.id && n.type !== 'note' && n.type !== 'data')
        .forEach(n => P.push(`        <bpmn:flowNodeRef>${n.id}</bpmn:flowNodeRef>`));
      P.push('      </bpmn:lane>');
    }
    P.push('    </bpmn:laneSet>');

    const planes = [];
    for (const n of nodes) {
      if (n.type === 'note' || n.type === 'data') continue;
      if (n.type === 'sub') { P.push(renderSubProcess(n)); planes.push(subPlane(n)); continue; }
      const body = [];
      if (n.doc) body.push(`      <bpmn:documentation>${esc(n.doc)}</bpmn:documentation>`);
      (incoming[n.id] || []).forEach(i => body.push(`      <bpmn:incoming>${i}</bpmn:incoming>`));
      (outgoing[n.id] || []).forEach(i => body.push(`      <bpmn:outgoing>${i}</bpmn:outgoing>`));
      dataOut.filter(d => d[0] === n.id).forEach(d => body.push(
        `      <bpmn:dataOutputAssociation id="DataOut_${d[1]}">\n        <bpmn:targetRef>${d[1]}</bpmn:targetRef>\n      </bpmn:dataOutputAssociation>`));
      if (n.t.def) body.push(`      <bpmn:${n.t.def} id="${n.id}_def" />`);
      const attach = n.attachedTo ? ` attachedToRef="${n.attachedTo}" cancelActivity="false"` : '';
      P.push(`    <bpmn:${n.t.tag} id="${n.id}"${n.name ? ` name="${esc(n.name)}"` : ''}${n.t.attrs || ''}${attach}>`);
      P.push(...body);
      P.push(`    </bpmn:${n.t.tag}>`);
    }
    nodes.filter(n => n.type === 'data').forEach(n => {
      P.push(`    <bpmn:dataObjectReference id="${n.id}" name="${esc(n.name)}" dataObjectRef="DataObject_${n.id}" />`);
      P.push(`    <bpmn:dataObject id="DataObject_${n.id}" />`);
    });
    flows.forEach(f => P.push(`    <bpmn:sequenceFlow id="${f.id}"${f.name ? ` name="${esc(f.name)}"` : ''} sourceRef="${f.src}" targetRef="${f.tgt}" />`));
    nodes.filter(n => n.type === 'note').forEach(n =>
      P.push(`    <bpmn:textAnnotation id="${n.id}">\n      <bpmn:text>${esc(n.name)}</bpmn:text>\n    </bpmn:textAnnotation>`));
    assoc.forEach(([s, a], i) => P.push(`    <bpmn:association id="Association_${i + 1}" sourceRef="${s}" targetRef="${a}" />`));
    groups.forEach((g, i) => P.push(`    <bpmn:group id="${g[0]}" categoryValueRef="CategoryValue_${i + 1}" />`));

    function renderSubProcess(n) {
      const c = subContent[n.id];
      if (!c) throw new Error('нет содержимого подпроцесса ' + n.id);
      const ids = c.tasks.map((_, i) => `${n.id}_T${i + 1}`);
      const seq = [`${n.id}_S`].concat(ids).concat([`${n.id}_E`]);
      const fl = seq.slice(0, -1).map((s, i) => ({ id: `${n.id}_F${i + 1}`, s, t: seq[i + 1] }));
      const inOut = id => {
        const i = fl.filter(f => f.t === id).map(f => `        <bpmn:incoming>${f.id}</bpmn:incoming>`);
        const o = fl.filter(f => f.s === id).map(f => `        <bpmn:outgoing>${f.id}</bpmn:outgoing>`);
        return i.concat(o).join('\n');
      };
      return `    <bpmn:subProcess id="${n.id}" name="${esc(n.name)}" triggeredByEvent="true">
${n.doc ? `      <bpmn:documentation>${esc(n.doc)}</bpmn:documentation>\n` : ''}      <bpmn:startEvent id="${n.id}_S" name="${esc(c.start)}" isInterrupting="false">
${inOut(`${n.id}_S`)}
        <bpmn:messageEventDefinition id="${n.id}_S_def" />
      </bpmn:startEvent>
${c.tasks.map((t, i) => `      <bpmn:userTask id="${ids[i]}" name="${esc(t)}">\n${inOut(ids[i])}\n      </bpmn:userTask>`).join('\n')}
      <bpmn:endEvent id="${n.id}_E" name="${esc(c.end)}">
${inOut(`${n.id}_E`)}
      </bpmn:endEvent>
${fl.map(f => `      <bpmn:sequenceFlow id="${f.id}" sourceRef="${f.s}" targetRef="${f.t}" />`).join('\n')}
    </bpmn:subProcess>`;
    }
    function subPlane(n) {
      const c = subContent[n.id];
      const shapes = [], edges = [];
      let x = 180;
      shapes.push(`      <bpmndi:BPMNShape id="${n.id}_S_di" bpmnElement="${n.id}_S">
        <dc:Bounds x="${x}" y="140" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="${x - 24}" y="183" width="84" height="27" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>`);
      let prevRight = x + 36;
      c.tasks.forEach((t, i) => {
        x = prevRight + 54;
        shapes.push(`      <bpmndi:BPMNShape id="${n.id}_T${i + 1}_di" bpmnElement="${n.id}_T${i + 1}">
        <dc:Bounds x="${x}" y="118" width="140" height="80" />
      </bpmndi:BPMNShape>`);
        edges.push([prevRight, x]);
        prevRight = x + 140;
      });
      x = prevRight + 54;
      shapes.push(`      <bpmndi:BPMNShape id="${n.id}_E_di" bpmnElement="${n.id}_E">
        <dc:Bounds x="${x}" y="140" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="${x - 22}" y="183" width="80" height="27" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>`);
      edges.push([prevRight, x]);
      const edgeXmls = edges.map((e, i) =>
        `      <bpmndi:BPMNEdge id="${n.id}_F${i + 1}_di" bpmnElement="${n.id}_F${i + 1}"><di:waypoint x="${e[0]}" y="158" /><di:waypoint x="${e[1]}" y="158" /></bpmndi:BPMNEdge>`);
      return `    <bpmndi:BPMNPlane id="BPMNPlane_${n.id}" bpmnElement="${n.id}">
${shapes.join('\n')}
${edgeXmls.join('\n')}
    </bpmndi:BPMNPlane>`;
    }

    /* ---------- DI ---------- */
    const maxRight = Math.max(...nodes.map(n => n.x + n.w));
    const POOLW = maxRight + 60 - POOL.x;
    const D = [];
    D.push(`      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true">
        <dc:Bounds x="${POOL.x}" y="${POOL.y}" width="${POOLW}" height="${POOL.h}" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>`);
    EXT.forEach(e => D.push(`      <bpmndi:BPMNShape id="${e.id}_di" bpmnElement="${e.id}" isHorizontal="true">
        <dc:Bounds x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>`));
    lanes.forEach(l => D.push(`      <bpmndi:BPMNShape id="${l.id}_di" bpmnElement="${l.id}" isHorizontal="true">
        <dc:Bounds x="${POOL.x + 30}" y="${l.y}" width="${POOLW - 30}" height="${l.h}" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>`));
    groups.forEach(g => {
      const c1 = byId[g[2]].col, c2 = byId[g[3]].col;
      const x = Math.round(X0 + c1 * COLW - 21), w = Math.round((c2 - c1) * COLW + TW + 42);
      D.push(`      <bpmndi:BPMNShape id="${g[0]}_di" bpmnElement="${g[0]}">
        <dc:Bounds x="${x}" y="${POOL.y + 8}" width="${w}" height="${POOL.h - 16}" />
        <bpmndi:BPMNLabel><dc:Bounds x="${x + 12}" y="${POOL.y + 14}" width="${w - 24}" height="22" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>`);
    });
    nodes.forEach(n => {
      let label = '';
      if ((n.name && n.w <= 50) || n.type === 'data')
        label = `\n        <bpmndi:BPMNLabel><dc:Bounds x="${Math.round(n.cx - 78)}" y="${n.y + n.h + 6}" width="156" height="${n.type === 'data' ? 34 : 40}" /></bpmndi:BPMNLabel>`;
      const extra = n.type === 'sub' ? ' isExpanded="false"' : '';
      D.push(`      <bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}"${extra}>
        <dc:Bounds x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" />${label}
      </bpmndi:BPMNShape>`);
    });
    const edgeXml = (id, el, wps, labelName) => {
      const pts = wps.map(p => `        <di:waypoint x="${Math.round(p.x)}" y="${Math.round(p.y)}" />`).join('\n');
      let label = '';
      if (labelName) {
        const m1 = wps[Math.floor(wps.length / 2) - 1] || wps[0], m2 = wps[Math.floor(wps.length / 2)] || wps[wps.length - 1];
        label = `\n        <bpmndi:BPMNLabel><dc:Bounds x="${Math.round((m1.x + m2.x) / 2) - 55}" y="${Math.round((m1.y + m2.y) / 2) - 26}" width="110" height="20" /></bpmndi:BPMNLabel>`;
      }
      return `      <bpmndi:BPMNEdge id="${id}" bpmnElement="${el}">\n${pts}${label}\n      </bpmndi:BPMNEdge>`;
    };
    flows.forEach(f => D.push(edgeXml(f.id + '_di', f.id, waypoints(f), f.name)));
    MSG.forEach(m => D.push(edgeXml(m.id + '_di', m.id, msgWaypoints(m), m.name)));
    assoc.forEach(([s, a], i) => D.push(edgeXml(`Association_${i + 1}_di`, `Association_${i + 1}`, assocWaypoints(byId[s], byId[a]))));
    dataOut.forEach(([s, d]) => D.push(edgeXml(`DataOut_${d}_di`, `DataOut_${d}`, assocWaypoints(byId[s], byId[d]))));

    const categories = groups.map((g, i) =>
      `  <bpmn:category id="Category_${i + 1}">\n    <bpmn:categoryValue id="CategoryValue_${i + 1}" value="${esc(g[1])}" />\n  </bpmn:category>`).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="${C.id}" targetNamespace="http://bpmn.io/schema/bpmn"
                  exporter="docs/process/lib/bpmn-builder.js" exporterVersion="1.0">
${categories}
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:documentation>${esc(C.collaborationDoc || C.processName)}</bpmn:documentation>
    <bpmn:participant id="Participant_1" name="${esc(C.poolName)}" processRef="Process_1" />
${EXT.map(e => `    <bpmn:participant id="${e.id}" name="${esc(e.name)}" />`).join('\n')}
${MSG.map(m => `    <bpmn:messageFlow id="${m.id}" name="${esc(m.name)}" sourceRef="${m.src}" targetRef="${m.tgt}" />`).join('\n')}
  </bpmn:collaboration>
  <bpmn:process id="Process_1" name="${esc(C.processName)}" isExecutable="false">
    <bpmn:documentation>${esc(C.processDoc || '')}</bpmn:documentation>
${P.join('\n')}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1" name="${esc(C.diagramName || C.processName)}">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
${D.join('\n')}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
${planes.map((p, i) => `  <bpmndi:BPMNDiagram id="BPMNDiagram_Sub${i + 1}">\n${p}\n  </bpmndi:BPMNDiagram>`).join('\n')}
</bpmn:definitions>
`;
    return { xml, problems, stats: { nodes: nodes.length, flows: flows.length, messages: MSG.length, width: POOLW, height: POOL.h } };
  }

  return { node, flow, insertMerge, external, message, annotate, data, group, subprocess, build, byId };
}

module.exports = { createModel };
