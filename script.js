const fileInput = document.getElementById('csvFile');
  const convertBtn = document.getElementById('convertBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const statusBox = document.getElementById('status');
  let csvText = '';
  let convertedData = null;

  // Read CSV rows while respecting commas and line breaks inside quoted values.
  function parseCSV(text) {
    const rows = [];
    let row = [], value = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { value += '"'; i++; }
        else if (char === '"') quoted = false;
        else value += char;
      } else {
        if (char === '"') quoted = true;
        else if (char === ',') { row.push(value); value = ''; }
        else if (char === '\n') {
          row.push(value); rows.push(row); row = []; value = '';
        } else if (char !== '\r') value += char;
      }
    }
    row.push(value);
    if (row.some(cell => cell.trim() !== '')) rows.push(row);
    return rows;
  }

  function capitalizeFirst(value) {
    const trimmed = String(value ?? '').trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase() : '';
  }

  const courseNames = {
    BSIT: 'Bachelor of Science in Information Technology',
    BSCS: 'Bachelor of Science in Computer Science'
  };

  fileInput.addEventListener('change', event => {
    const file = event.target.files[0];
    convertedData = null;
    downloadBtn.disabled = true;
    document.getElementById('previewSection').hidden = true;
    if (!file) { convertBtn.disabled = true; return; }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showStatus('Please select a CSV file.', true);
      convertBtn.disabled = true;
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      csvText = String(reader.result || '').replace(/^\uFEFF/, '');
      convertBtn.disabled = false;
      showStatus(`Loaded ${file.name}. Click “Convert to JSON” to continue.`, false);
    };
    reader.onerror = () => {
      showStatus('The selected file could not be read.', true);
      convertBtn.disabled = true;
    };
    reader.readAsText(file);
  });

  convertBtn.addEventListener('click', () => {
    try {
      const rows = parseCSV(csvText);
      if (rows.length < 2) throw new Error('The CSV file has no student records.');
      const headers = rows[0].map(h => h.trim().toLowerCase());
      const required = ['student_id','first_name','last_name','course','year_level','email','tuition_balance'];
      const missing = required.filter(field => !headers.includes(field));
      if (missing.length) throw new Error('Missing required CSV column(s): ' + missing.join(', '));

      const index = Object.fromEntries(required.map(field => [field, headers.indexOf(field)]));
      convertedData = rows.slice(1).filter(row => row.some(cell => cell.trim() !== '')).map((row, rowIndex) => {
        const get = field => (row[index[field]] ?? '').trim();
        const studentId = Number(get('student_id'));
        const yearLevel = Number(get('year_level'));
        const balance = Number(get('tuition_balance'));
        const course = get('course').toUpperCase();
        if (!Number.isInteger(studentId) || !Number.isInteger(yearLevel) || !Number.isFinite(balance))
          throw new Error(`Invalid numeric value in CSV data row ${rowIndex + 2}.`);
        if (!courseNames[course]) throw new Error(`Unknown course code "${course}" in CSV data row ${rowIndex + 2}.`);
        return {
          studentId,
          firstName: capitalizeFirst(get('first_name')),
          lastName: capitalizeFirst(get('last_name')),
          program: courseNames[course],
          yearLevel,
          emailAddress: get('email').toLowerCase(),
          outstandingBalance: Number(balance.toFixed(2))
        };
      });

      const json = JSON.stringify(convertedData, null, 2);
      document.getElementById('jsonOutput').textContent = json;
      document.getElementById('recordCount').textContent = `${convertedData.length} student record(s) converted successfully.`;
      const tbody = document.getElementById('previewBody');
      tbody.replaceChildren();
      convertedData.forEach(student => {
        const tr = document.createElement('tr');
        Object.values(student).forEach(value => {
          const td = document.createElement('td');
          td.textContent = typeof value === 'number' && Number.isInteger(value) ? String(value) :
            (typeof value === 'number' ? value.toFixed(2) : value);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      document.getElementById('previewSection').hidden = false;
      downloadBtn.disabled = false;
      showStatus('Conversion completed successfully!', false);
    } catch (error) {
      convertedData = null;
      downloadBtn.disabled = true;
      showStatus(error.message, true);
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (!convertedData) return;
    const blob = new Blob([JSON.stringify(convertedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'students_converted.json';
    link.click();
    URL.revokeObjectURL(url);
  });

  function showStatus(message, isError) {
    statusBox.textContent = message;
    statusBox.className = 'status ' + (isError ? 'error' : 'success');
  }
