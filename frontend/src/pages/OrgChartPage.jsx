import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import client from '../api/client';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import './OrgChartPage.css';

// ── Tree builder ──────────────────────────────────────────────────────────────
function buildTree(employees) {
  const map = {};
  employees.forEach((e) => { map[e.id] = { ...e, children: [] }; });
  const roots = [];
  employees.forEach((e) => {
    if (e.managerId && map[e.managerId]) map[e.managerId].children.push(map[e.id]);
    else roots.push(map[e.id]);
  });
  return roots;
}

// ── Employee card ─────────────────────────────────────────────────────────────
function OrgCard({ employee, highlight }) {
  const initials = `${employee.firstName?.[0] || ''}${employee.lastName?.[0] || ''}`.toUpperCase();
  return (
    <div className={`org-card ${highlight === 'on' ? 'highlighted' : highlight === 'dim' ? 'dimmed' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div className="org-card-avatar">{initials}</div>
        <div style={{ minWidth: 0 }}>
          <div className="org-card-name">{employee.firstName} {employee.lastName}</div>
          <div className="org-card-position">{employee.position || 'No position'}</div>
        </div>
      </div>
      <div className="org-card-meta">
        {employee.department?.name && (
          <span className="org-card-dept">🏢 {employee.department.name}</span>
        )}
        <StatusBadge status={employee.status || 'active'} />
      </div>
    </div>
  );
}

// ── Recursive tree node ───────────────────────────────────────────────────────
function OrgNode({ node, search, matchIds }) {
  const children    = node.children || [];
  const hasChildren = children.length > 0;
  const highlight   = search ? (matchIds.has(node.id) ? 'on' : 'dim') : '';

  return (
    <div className="org-node">
      <OrgCard employee={node} highlight={highlight} />

      {hasChildren && (
        <>
          {/* Vertical line from card down to horizontal bar */}
          <div className="org-line-v" style={{ height: 24 }} />
          <div className="org-children-row">
            {children.map((child) => (
              <div key={child.id} className="org-child-wrap">
                {/* Vertical line from horizontal bar down to child card */}
                <div className="org-line-v" style={{ height: 24 }} />
                <OrgNode node={child} search={search} matchIds={matchIds} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.1;
const INITIAL_ZOOM = 0.75;

function OrgChartPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');
  const [zoomPct, setZoomPct]     = useState(Math.round(INITIAL_ZOOM * 100));

  // Refs for imperative pan/zoom — avoids re-rendering on every drag frame
  const canvasRef   = useRef(null);
  const treeRef     = useRef(null);
  const isDragging  = useRef(false);
  const lastMouse   = useRef({ x: 0, y: 0 });
  const pan         = useRef({ x: 0, y: 0 });
  const zoom        = useRef(INITIAL_ZOOM);
  const lastPinch   = useRef(null);

  // Apply transform directly to DOM — no React state update needed per frame
  const applyTransform = useCallback(() => {
    if (!treeRef.current) return;
    treeRef.current.style.transform =
      `translateX(calc(-50% + ${pan.current.x}px)) translateY(${pan.current.y}px) scale(${zoom.current})`;
  }, []);

  useEffect(() => {
    client.get('/api/employees')
      .then(({ data }) => setEmployees(data.employees))
      .catch(() => setError('Failed to load employees'))
      .finally(() => setLoading(false));
  }, []);

  // Set initial transform once tree mounts
  useEffect(() => { applyTransform(); }, [employees, applyTransform]);

  // ── Mouse events ─────────────────────────────────────────────────────────

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    lastMouse.current  = { x: e.clientX, y: e.clientY };
    canvasRef.current?.classList.add('dragging');
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    pan.current.x += e.clientX - lastMouse.current.x;
    pan.current.y += e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    applyTransform();
  }, [applyTransform]);

  const onMouseUp = useCallback(() => {
    isDragging.current = false;
    canvasRef.current?.classList.remove('dragging');
  }, []);

  // ── Wheel zoom (no Ctrl required — canvas-only scroll) ───────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e) => {
      e.preventDefault();
      const delta  = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      zoom.current = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom.current + delta));
      setZoomPct(Math.round(zoom.current * 100));
      applyTransform();
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, [applyTransform]);

  // ── Touch events (one-finger pan, two-finger pinch zoom) ─────────────────

  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      isDragging.current = true;
      lastMouse.current  = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      isDragging.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinch.current = Math.hypot(dx, dy);
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging.current) {
      pan.current.x += e.touches[0].clientX - lastMouse.current.x;
      pan.current.y += e.touches[0].clientY - lastMouse.current.y;
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      applyTransform();
    } else if (e.touches.length === 2 && lastPinch.current) {
      const dx   = e.touches[0].clientX - e.touches[1].clientX;
      const dy   = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / lastPinch.current;
      zoom.current = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom.current * scale));
      lastPinch.current = dist;
      setZoomPct(Math.round(zoom.current * 100));
      applyTransform();
    }
  }, [applyTransform]);

  const onTouchEnd = useCallback(() => {
    isDragging.current = false;
    lastPinch.current  = null;
  }, []);

  // ── Zoom buttons ─────────────────────────────────────────────────────────

  const zoomIn  = () => {
    zoom.current = Math.min(ZOOM_MAX, +(zoom.current + ZOOM_STEP).toFixed(2));
    setZoomPct(Math.round(zoom.current * 100));
    applyTransform();
  };
  const zoomOut = () => {
    zoom.current = Math.max(ZOOM_MIN, +(zoom.current - ZOOM_STEP).toFixed(2));
    setZoomPct(Math.round(zoom.current * 100));
    applyTransform();
  };
  const resetView = () => {
    pan.current  = { x: 0, y: 0 };
    zoom.current = INITIAL_ZOOM;
    setZoomPct(Math.round(INITIAL_ZOOM * 100));
    applyTransform();
  };

  // ── Data ─────────────────────────────────────────────────────────────────

  const roots = useMemo(() => buildTree(employees), [employees]);

  const matchIds = useMemo(() => {
    if (!search.trim()) return new Set();
    const q = search.toLowerCase();
    return new Set(
      employees
        .filter((e) =>
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
          (e.position || '').toLowerCase().includes(q) ||
          (e.department?.name || '').toLowerCase().includes(q)
        )
        .map((e) => e.id)
    );
  }, [search, employees]);

  const deptCount = useMemo(() =>
    new Set(employees.map((e) => e.departmentId).filter(Boolean)).size,
  [employees]);

  if (loading) return <Spinner />;
  if (error)   return <p className="error-msg">{error}</p>;

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ margin: 0 }}>
          {employees.length} employee{employees.length !== 1 ? 's' : ''}
          {deptCount > 0 && ` · ${deptCount} dept${deptCount !== 1 ? 's' : ''}`}
        </h3>

        <div className="org-toolbar">
          <input
            className="search-input"
            placeholder="Search name, position, dept…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
          />

          <div className="org-zoom-controls">
            <button className="org-zoom-btn" onClick={zoomOut} title="Zoom out">−</button>
            <span className="org-zoom-pct">{zoomPct}%</span>
            <button className="org-zoom-btn" onClick={zoomIn}  title="Zoom in">+</button>
          </div>

          <button className="org-reset-btn" onClick={resetView}>Reset view</button>

          <span className="org-hint">Drag to pan · Scroll to zoom</span>
        </div>
      </div>

      {/* ── Canvas ──────────────────────────────────────────────────────── */}
      <div
        ref={canvasRef}
        className="org-canvas"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div ref={treeRef} className="org-tree-wrap">
          {roots.length === 0 ? (
            <p style={{ color: '#94a3b8', padding: 48, fontSize: 15 }}>
              No employees yet.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start' }}>
              {roots.map((root) => (
                <OrgNode key={root.id} node={root} search={search} matchIds={matchIds} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default OrgChartPage;
