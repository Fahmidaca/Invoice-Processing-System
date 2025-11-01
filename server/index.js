const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createWorker } = require('tesseract.js');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

// Create uploads directory
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Database setup
const db = new sqlite3.Database('./invoice_processing.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    initDatabase();
  }
});

function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      filename TEXT,
      original_filename TEXT,
      extracted_text TEXT,
      processed_data TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT,
      tax_id TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// OCR Processing function
async function processInvoice(filePath) {
  const worker = await createWorker('eng');

  try {
    const { data: { text } } = await worker.recognize(filePath);
    await worker.terminate();
    return text;
  } catch (error) {
    await worker.terminate();
    throw error;
  }
}

// Enhanced invoice data extraction from OCR text
function extractInvoiceData(text) {
  const data = {
    invoice_number: '',
    date: '',
    due_date: '',
    total_amount: '',
    supplier_name: '',
    supplier_address: '',
    customer_name: '',
    customer_address: '',
    items: [],
    tax_rate: 0,
    discount_rate: 0,
    currency: 'USD'
  };

  // Clean and normalize text
  const cleanText = text.replace(/\s+/g, ' ').toLowerCase();

  // Enhanced regex patterns for better extraction
  // Invoice number patterns
  const invoicePatterns = [
    /invoice\s*#?\s*:?\s*([a-z0-9\-]+)/i,
    /inv\s*#?\s*:?\s*([a-z0-9\-]+)/i,
    /invoice\s+no\.?\s*:?\s*([a-z0-9\-]+)/i,
    /bill\s*#?\s*:?\s*([a-z0-9\-]+)/i,
    /receipt\s*#?\s*:?\s*([a-z0-9\-]+)/i
  ];

  for (const pattern of invoicePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.invoice_number = match[1].trim();
      break;
    }
  }

  // Date patterns (more comprehensive)
  const datePatterns = [
    /date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /invoice\s+date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /issue\s+date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.date = match[1].trim();
      break;
    }
  }

  // Due date patterns
  const dueDatePatterns = [
    /due\s+date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /payment\s+due\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /due\s+by\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
  ];

  for (const pattern of dueDatePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.due_date = match[1].trim();
      break;
    }
  }

  // Total amount patterns (more comprehensive)
  const totalPatterns = [
    /total\s*:?\s*[\$৳€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /grand\s+total\s*:?\s*[\$৳€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /amount\s+due\s*:?\s*[\$৳€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /balance\s+due\s*:?\s*[\$৳€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /net\s+amount\s*:?\s*[\$৳€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i
  ];

  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.total_amount = match[1].replace(/,/g, '').trim();
      break;
    }
  }

  // Supplier/Customer name patterns
  const supplierPatterns = [
    /supplier\s*:?\s*([^\n\r]+)/i,
    /from\s*:?\s*([^\n\r]+)/i,
    /company\s*:?\s*([^\n\r]+)/i,
    /vendor\s*:?\s*([^\n\r]+)/i,
    /seller\s*:?\s*([^\n\r]+)/i
  ];

  for (const pattern of supplierPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.supplier_name = match[1].trim();
      break;
    }
  }

  // Customer/Bill to patterns
  const customerPatterns = [
    /bill\s+to\s*:?\s*([^\n\r]+)/i,
    /customer\s*:?\s*([^\n\r]+)/i,
    /client\s*:?\s*([^\n\r]+)/i,
    /to\s*:?\s*([^\n\r]+)/i
  ];

  for (const pattern of customerPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.customer_name = match[1].trim();
      break;
    }
  }

  // Address extraction (basic)
  const addressPatterns = [
    /address\s*:?\s*([^\n\r]+)/i,
    /location\s*:?\s*([^\n\r]+)/i
  ];

  for (const pattern of addressPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.supplier_address = match[1].trim();
      break;
    }
  }

  // Currency detection
  if (text.includes('$') || text.toLowerCase().includes('usd')) {
    data.currency = 'USD';
  } else if (text.includes('৳') || text.toLowerCase().includes('bdt')) {
    data.currency = 'BDT';
  } else if (text.includes('€') || text.toLowerCase().includes('eur')) {
    data.currency = 'EUR';
  } else if (text.includes('£') || text.toLowerCase().includes('gbp')) {
    data.currency = 'GBP';
  }

  // Tax rate extraction
  const taxPatterns = [
    /tax\s*:?\s*(\d+(?:\.\d+)?)%/i,
    /vat\s*:?\s*(\d+(?:\.\d+)?)%/i,
    /gst\s*:?\s*(\d+(?:\.\d+)?)%/i
  ];

  for (const pattern of taxPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.tax_rate = parseFloat(match[1]);
      break;
    }
  }

  // Discount extraction
  const discountPatterns = [
    /discount\s*:?\s*(\d+(?:\.\d+)?)%/i,
    /discount\s+rate\s*:?\s*(\d+(?:\.\d+)?)%/i
  ];

  for (const pattern of discountPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.discount_rate = parseFloat(match[1]);
      break;
    }
  }

  // Basic item extraction (simplified)
  const lines = text.split('\n');
  const itemLines = lines.filter(line =>
    /\d+\s*[x×]\s*[\$৳€£]?\s*\d+/.test(line) || // quantity x price
    /\d+\s*@\s*[\$৳€£]?\s*\d+/.test(line) || // quantity @ price
    /\d+\s*[\$৳€£]?\s*\d+/.test(line) // quantity price
  );

  data.items = itemLines.slice(0, 5).map(line => {
    const parts = line.trim().split(/\s+/);
    return {
      name: parts.slice(0, -2).join(' ') || 'Item',
      quantity: parseInt(parts[parts.length - 2]) || 1,
      rate: parseFloat(parts[parts.length - 1].replace(/[^\d.]/g, '')) || 0
    };
  });

  // If no items found, create a default item with total amount
  if (data.items.length === 0 && data.total_amount) {
    data.items = [{
      name: 'Service/Item',
      quantity: 1,
      rate: parseFloat(data.total_amount)
    }];
  }

  return data;
}

// API Routes

// Create new invoice
app.post('/api/invoices', (req, res) => {
  const invoiceData = req.body;

  if (!invoiceData.processed_data) {
    return res.status(400).json({ error: 'Invoice data is required' });
  }

  // Generate a new unique ID for the invoice
  const invoiceId = uuidv4();

  // Clean the processed_data to remove any ID field that might conflict
  const cleanProcessedData = { ...invoiceData.processed_data };
  delete cleanProcessedData.id; // Remove any existing ID

  db.run(`
    INSERT INTO invoices (id, filename, original_filename, extracted_text, processed_data, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    invoiceId,
    '',
    '',
    '',
    JSON.stringify(cleanProcessedData),
    invoiceData.status || 'created'
  ], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({
      id: invoiceId,
      status: 'created',
      message: 'Invoice created successfully'
    });
  });
});

// Upload and process invoice (OCR)
app.post('/api/invoices/upload', upload.single('invoice'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const invoiceId = uuidv4();
    const filePath = req.file.path;

    // Process with OCR
    const extractedText = await processInvoice(filePath);
    const processedData = extractInvoiceData(extractedText);

    // Save to database
    db.run(`
      INSERT INTO invoices (id, filename, original_filename, extracted_text, processed_data, status)
      VALUES (?, ?, ?, ?, ?, 'processed')
    `, [invoiceId, req.file.filename, req.file.originalname, extractedText, JSON.stringify(processedData)], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        id: invoiceId,
        status: 'processed',
        data: processedData,
        extracted_text: extractedText
      });
    });

  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

// Get all invoices
app.get('/api/invoices', (req, res) => {
  db.all('SELECT * FROM invoices ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    const invoices = rows.map(row => ({
      ...row,
      processed_data: row.processed_data ? JSON.parse(row.processed_data) : null
    }));

    res.json(invoices);
  });
});

// Get specific invoice
app.get('/api/invoices/:id', (req, res) => {
  db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = {
      ...row,
      processed_data: row.processed_data ? JSON.parse(row.processed_data) : null
    };

    res.json(invoice);
  });
});

// Update invoice data
app.put('/api/invoices/:id', (req, res) => {
  const { processed_data } = req.body;

  db.run(`
    UPDATE invoices
    SET processed_data = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [JSON.stringify(processed_data), req.params.id], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ message: 'Invoice updated successfully' });
  });
});

// Sync endpoint for offline data
app.post('/api/sync', (req, res) => {
  const { invoices } = req.body;

  if (!invoices || !Array.isArray(invoices)) {
    return res.status(400).json({ error: 'Invalid sync data' });
  }

  // Process sync data (simplified - in real app would handle conflicts)
  const promises = invoices.map(invoice => {
    return new Promise((resolve, reject) => {
      db.run(`
        INSERT OR REPLACE INTO invoices (id, filename, original_filename, extracted_text, processed_data, status, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        invoice.id,
        invoice.filename || '',
        invoice.original_filename || '',
        invoice.extracted_text || '',
        JSON.stringify(invoice.processed_data || {}),
        invoice.status || 'synced'
      ], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  Promise.all(promises)
    .then(() => res.json({ message: 'Sync completed successfully' }))
    .catch(err => {
      console.error('Sync error:', err);
      res.status(500).json({ error: 'Sync failed' });
    });
});

// Suppliers endpoints
app.get('/api/suppliers', (req, res) => {
  db.all('SELECT * FROM suppliers ORDER BY name', [], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

app.post('/api/suppliers', (req, res) => {
  const { name, tax_id, address } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Supplier name is required' });
  }

  const supplierId = uuidv4();

  db.run(`
    INSERT INTO suppliers (id, name, tax_id, address)
    VALUES (?, ?, ?, ?)
  `, [supplierId, name, tax_id || '', address || ''], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({
      id: supplierId,
      name,
      tax_id,
      address
    });
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});
