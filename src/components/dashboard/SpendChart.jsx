import React, { useState } from 'react';

export function formatCop(value) {
  const num = Number(value) || 0;
  return `$${num.toLocaleString('es-CO')} COP`;
}

export function formatInt(value) {
  return (Number(value) || 0).toLocaleString('es-CO');
}

/**
 * Gráfico interactivo SVG de barras y línea de evolución de gasto en COP y tokens
 */
export default function SpendChart({ series = [], metric = 'cost' }) {
  const [activeIndex, setActiveIndex] = useState(null);

  if (!series.length) {
    return (
      <div className="chart-empty-box">
        <p>No hay actividad registrada en el rango seleccionado.</p>
      </div>
    );
  }

  const values = series.map((item) => (metric === 'tokens' ? item.tokens : item.costCop));
  const maxVal = Math.max(10, ...values);
  const activePoint = activeIndex !== null && series[activeIndex] ? series[activeIndex] : series[series.length - 1];

  return (
    <div className="interactive-chart-shell">
      <div className="chart-tooltip-bar" aria-live="polite">
        <div className="tooltip-date-block">
          <span className="tooltip-label">Periodo seleccionado:</span>
          <strong>{activePoint.label}</strong>
        </div>
        <div className="tooltip-metrics-row">
          <span>
            Gasto: <strong>{formatCop(activePoint.costCop)}</strong>
          </span>
          <span>
            Solicitudes: <strong>{formatInt(activePoint.requests)}</strong>
          </span>
          <span>
            Tokens: <strong>{formatInt(activePoint.tokens)}</strong> ({formatInt(activePoint.inputTokens)} in /{' '}
            {formatInt(activePoint.outputTokens)} out)
          </span>
        </div>
      </div>

      <div className="chart-bars-grid" role="img" aria-label="Gráfico interactivo de evolución de consumo">
        {series.map((point, idx) => {
          const val = metric === 'tokens' ? point.tokens : point.costCop;
          const heightPct = Math.max(4, Math.round((val / maxVal) * 100));
          const isHovered = activeIndex === idx;

          return (
            <button
              key={point.key}
              type="button"
              className={`chart-bar-col ${isHovered ? 'is-active' : ''}`}
              onMouseEnter={() => setActiveIndex(idx)}
              onFocus={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
              aria-label={`${point.label}: ${formatCop(point.costCop)}, ${point.requests} solicitudes`}
            >
              <span className="chart-bar-value">
                {val > 0 ? (metric === 'tokens' ? formatInt(val) : `$${val}`) : ''}
              </span>
              <div className="chart-bar-track">
                <div
                  className={`chart-bar-fill ${val === 0 ? 'is-zero' : ''}`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="chart-bar-label">{point.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
