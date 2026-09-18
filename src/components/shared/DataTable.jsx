import { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import EmptyState from './EmptyState';
import './DataTable.css';

const PAGE_SIZE = 8;

export default function DataTable({
  data,
  columns,
  searchPlaceholder = 'Cari...',
  searchKeys = [],
  filters = null,
  activeFilter = 'all',
  onFilterChange = null,
  emptyTitle = 'Tidak ada data',
  emptyDesc = '',
  renderRow,
}) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  // Filter
  const filtered = useMemo(() => {
    let result = [...data];

    // Search
    if (search.trim() && searchKeys.length > 0) {
      const q = search.toLowerCase();
      result = result.filter(item =>
        searchKeys.some(key => {
          const val = item[key];
          return val != null && String(val).toLowerCase().includes(q);
        })
      );
    }

    // External filter
    if (activeFilter && activeFilter !== 'all') {
      result = result.filter(item => item.status === activeFilter);
    }

    // Sort
    if (sortKey) {
      result.sort((a, b) => {
        let aVal = a[sortKey];
        let bVal = b[sortKey];
        if (aVal == null) aVal = '';
        if (bVal == null) bVal = '';
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, search, searchKeys, activeFilter, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  }

  // Reset page on search/filter
  function handleSearch(val) {
    setSearch(val);
    setPage(1);
  }

  function handleFilter(f) {
    if (onFilterChange) onFilterChange(f);
    setPage(1);
  }

  return (
    <div className="data-table-wrapper">
      <div className="data-table-toolbar">
        <div className="data-table-toolbar-left">
          <div className="data-table-search">
            <Search size={16} className="data-table-search-icon" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>
          {filters && (
            <div className="data-table-filters">
              {filters.map(f => (
                <button
                  key={f.id}
                  className={`filter-chip ${activeFilter === f.id ? `active ${f.id}` : ''}`}
                  onClick={() => handleFilter(f.id)}
                >
                  {f.symbol && <span className="filter-chip-symbol">{f.symbol}</span>}
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {paged.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDesc} />
      ) : (
        <>
          <div className="data-table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      className={`${col.sortable ? 'sortable' : ''} ${sortKey === col.key ? 'sorted' : ''}`}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                      style={col.width ? { width: col.width } : undefined}
                    >
                      {col.label}
                      {col.sortable && (
                        <span className="sort-icon">
                          {sortKey === col.key ? (
                            sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          ) : (
                            <ChevronUp size={14} />
                          )}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((item, idx) => renderRow(item, idx))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="data-table-pagination">
              <span className="data-table-pagination-info">
                Menampilkan {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} dari {filtered.length} data
              </span>
              <div className="data-table-pagination-controls">
                <button
                  className="page-btn"
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 1}
                  aria-label="Halaman sebelumnya"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) {
                      acc.push('...');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '...' ? (
                      <span key={`dots-${i}`} style={{ padding: '0 4px', color: 'var(--gray-400)' }}>…</span>
                    ) : (
                      <button
                        key={p}
                        className={`page-btn ${page === p ? 'active' : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  className="page-btn"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page === totalPages}
                  aria-label="Halaman berikutnya"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
