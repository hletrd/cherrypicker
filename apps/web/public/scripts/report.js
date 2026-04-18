function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [key, val] of Object.entries(attrs)) {
      if (key === 'style') {
        for (const [prop, v] of Object.entries(val)) {
          node.style[prop] = v;
        }
      } else {
        node.setAttribute(key, val);
      }
    }
  }
  if (children) {
    for (const child of children) {
      if (typeof child === 'string') {
        node.appendChild(document.createTextNode(child));
      } else if (child) {
        node.appendChild(child);
      }
    }
  }
  return node;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('print-report')?.addEventListener('click', () => window.print());

  try {
    const raw = sessionStorage.getItem('cherrypicker:analysis');
    if (!raw) return;

    const data = JSON.parse(raw);
    const opt = data.optimization;
    if (!opt) return;

    const formatWon = (amount) => Number.isFinite(amount) ? amount.toLocaleString('ko-KR') + '원' : '0원';
    const reportContent = document.getElementById('report-content');
    if (!reportContent) return;

    const uniqueCards = new Set(opt.assignments.map((assignment) => assignment.assignedCardId)).size;

    // Summary heading
    reportContent.appendChild(el('h2', { style: { fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' } }, ['분석 요약']));

    // Summary table
    const summaryTable = el('table', { style: { width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' } });

    function summaryRow(label, value) {
      return el('tr', {}, [
        el('td', { style: { padding: '8px', borderBottom: '1px solid #e2e8f0' } }, [label]),
        el('td', { style: { padding: '8px', borderBottom: '1px solid #e2e8f0' } }, [value]),
      ]);
    }

    const period = data.statementPeriod
      ? data.statementPeriod.start + ' ~ ' + data.statementPeriod.end
      : '-';

    summaryTable.appendChild(summaryRow('분석 기간', period));
    summaryTable.appendChild(summaryRow('총 지출', formatWon(opt.totalSpending)));
    summaryTable.appendChild(summaryRow('체리피킹 혜택', formatWon(opt.totalReward)));
    summaryTable.appendChild(summaryRow('추가 절약', formatWon(opt.savingsVsSingleCard)));
    summaryTable.appendChild(summaryRow('사용 카드 수', uniqueCards + '장'));
    reportContent.appendChild(summaryTable);

    // Assignments heading
    reportContent.appendChild(el('h2', { style: { fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' } }, ['추천 카드 조합']));

    // Assignments table
    const assignTable = el('table', { style: { width: '100%', borderCollapse: 'collapse' } });

    // Header row
    const thead = el('thead', {}, [
      el('tr', { style: { background: '#f8fafc' } }, [
        el('th', { style: { padding: '8px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' } }, ['카테고리']),
        el('th', { style: { padding: '8px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' } }, ['추천 카드']),
        el('th', { style: { padding: '8px', textAlign: 'right', borderBottom: '2px solid #e2e8f0' } }, ['혜택']),
        el('th', { style: { padding: '8px', textAlign: 'right', borderBottom: '2px solid #e2e8f0' } }, ['지출']),
      ]),
    ]);
    assignTable.appendChild(thead);

    // Body rows
    const tbody = el('tbody');
    for (const assignment of opt.assignments) {
      tbody.appendChild(el('tr', {}, [
        el('td', { style: { padding: '8px', borderBottom: '1px solid #e2e8f0' } }, [assignment.categoryNameKo]),
        el('td', { style: { padding: '8px', borderBottom: '1px solid #e2e8f0' } }, [assignment.assignedCardName]),
        el('td', { style: { padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right' } }, [formatWon(assignment.reward)]),
        el('td', { style: { padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right' } }, [formatWon(assignment.spending)]),
      ]));
    }
    assignTable.appendChild(tbody);
    reportContent.appendChild(assignTable);
  } catch {
    // Ignore malformed persisted state.
  }
});
