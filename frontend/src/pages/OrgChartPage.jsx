import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import client from '../api/client';
import Avatar from '../components/ui/Avatar';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import './OrgChartPage.css';

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);

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
  return (
    <div className={[
      'bg-white rounded-xl ring-1 ring-slate-200 shadow-sm p-4 w-48 pointer-events-auto transition-shadow hover:shadow-md',
      highlight === 'on'  ? 'ring-brand-500 shadow-[0_0_0_3px_rgba(99,102,241,0.15)]' : '',
      highlight === 'dim' ? 'opacity-25' : '',
    ].filter(Boolean).join(' ')}>
      <div className="flex items-center gap-2.5 mb-2">
        <Avatar firstName={employee.firstName} lastName={employee.lastName} size="sm" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">{employee.firstName} {employee.lastName}</div>
          <div className="text-xs text-slate-500 truncate">{employee.position || 'No position'}</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {employee.department?.name && (
          <span className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-full truncate max-w-[110px]">
            🏢 {employee.department.name}
          </span>
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
          <div className="org-line-v" style={{ height: 24 }} />
          <div className="org-children-row">
            {children.map((child) => (
              <div key={child.id} className="org-child-wrap">
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

  const canvasRef  = useRef(null);
  const treeRef    = useRef(null);
  const isDragging = useRef(false);
  const lastMouse  = useRef({ x: 0, y: 0 });
  const pan        = useRef({ x: 0, y: 0 });
  const zoom       = useRef(INITIAL_ZOOM);
  const lastPinch  = useRef(null);

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

  // ── Wheel zoom ───────────────────────────────────────────────────────────

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

  // ── Touch events ─────────────────────────────────────────────────────────

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
      zoom.current = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom.current * (dist / lastPinch.current)));
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

  const zoomIn = () => {
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
  if (error)   return <p className="py-10 text-center text-red-500 text-sm">{error}</p>;

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Org Chart</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {employees.length} employee{employees.length !== 1 ? 's' : ''}
            {deptCount > 0 && ` · ${deptCount} dept${deptCount !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <SearchIcon />
            </span>
            <input
              className="h-[42px] pl-10 pr-4 w-56 rounded-lg border-[1.5px] border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:shadow-focus transition-all duration-200"
              placeholder="Search name, position, dept…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg px-1.5 py-1">
            <button
              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors text-lg leading-none"
              onClick={zoomOut} title="Zoom out"
            >−</button>
            <span className="text-xs font-semibold text-slate-500 min-w-[36px] text-center">{zoomPct}%</span>
            <button
              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors text-lg leading-none"
              onClick={zoomIn} title="Zoom in"
            >+</button>
          </div>

          <button
            className="text-xs font-medium text-slate-600 border border-slate-200 rounded-lg px-2.5 py-2 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap"
            onClick={resetView}
          >
            Reset view
          </button>

          <span className="text-xs text-slate-400 whitespace-nowrap hidden sm:inline">Drag to pan · Scroll to zoom</span>
        </div>
      </div>

      {/* ── Canvas ── */}
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
            <p className="text-slate-400 p-12 text-sm">No employees yet.</p>
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
