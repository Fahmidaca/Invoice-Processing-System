import React, { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import './App.css';

// Dynamic API URL for different environments
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [invoices, setInvoices] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  // const [showScanner, setShowScanner] = useState(false); // Not used currently

  useEffect(() => {
    loadInvoices();
    loadPendingInvoices();
    setupNetworkListeners();
    checkOnlineStatus(); // Initial check

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isOnline && pendingInvoices.length > 0) {
      syncPendingInvoices();
    }
  }, [isOnline, pendingInvoices]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkOnlineStatus = async () => {
    try {
      // Test actual connectivity by making a request to the server
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      setIsOnline(response.ok);
    } catch (error) {
      setIsOnline(false);
    }
  };

  const setupNetworkListeners = () => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  };

  const handleOnline = async () => {
    // Double-check connectivity
    await checkOnlineStatus();
  };

  const handleOffline = () => {
    setIsOnline(false);
  };

  const loadInvoices = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/invoices`);
      if (response.ok) {
        const data = await response.json();
        setInvoices(data);
        // Save to local storage for offline access
        localStorage.setItem('invoices', JSON.stringify(data));
      } else {
        // Load from local storage if offline
        const localInvoices = localStorage.getItem('invoices');
        if (localInvoices) {
          setInvoices(JSON.parse(localInvoices));
        }
      }
    } catch (error) {
      console.error('Failed to load invoices:', error);
      // Load from local storage
      const localInvoices = localStorage.getItem('invoices');
      if (localInvoices) {
        setInvoices(JSON.parse(localInvoices));
      }
    }
  };

  const loadPendingInvoices = () => {
    const pending = localStorage.getItem('pendingInvoices');
    if (pending) {
      setPendingInvoices(JSON.parse(pending));
    }
  };

  const savePendingInvoice = (invoiceData) => {
    const newPending = [...pendingInvoices, invoiceData];
    setPendingInvoices(newPending);
    localStorage.setItem('pendingInvoices', JSON.stringify(newPending));
  };

  const syncPendingInvoices = async () => {
    if (pendingInvoices.length === 0) return;

    for (const invoice of pendingInvoices) {
      try {
        const response = await fetch(`${API_BASE_URL}/invoices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invoice)
        });

        if (response.ok) {
          // Remove from pending
          setPendingInvoices(prev => prev.filter(inv => inv.id !== invoice.id));
          localStorage.setItem('pendingInvoices', JSON.stringify(
            pendingInvoices.filter(inv => inv.id !== invoice.id)
          ));
          loadInvoices(); // Refresh the list
        }
      } catch (error) {
        console.error('Failed to sync invoice:', error);
      }
    }
  };

  const saveInvoice = async (invoiceData) => {
    // Handle the data structure from InvoiceCreator
    // invoiceData should have: { processed_data, status, created_at }
    const invoicePayload = {
      processed_data: invoiceData.processed_data,
      status: invoiceData.status || 'created',
      created_at: invoiceData.created_at || new Date().toISOString()
    };

    if (isOnline) {
      try {
        const response = await fetch(`${API_BASE_URL}/invoices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invoicePayload)
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Invoice saved successfully:', result);
          loadInvoices();
          return true;
        } else {
          const errorText = await response.text();
          console.error('Failed to save invoice:', response.status, errorText);
        }
      } catch (error) {
        console.error('Failed to save online, saving offline:', error);
        savePendingInvoice(invoicePayload);
        // Add to local invoices immediately with a temporary ID
        const tempInvoice = { ...invoicePayload, id: `temp-${Date.now()}` };
        setInvoices(prev => [tempInvoice, ...prev]);
        return true;
      }
    } else {
      // Save offline
      savePendingInvoice(invoicePayload);
      const tempInvoice = { ...invoicePayload, id: `temp-${Date.now()}` };
      setInvoices(prev => [tempInvoice, ...prev]);
      return true;
    }
    return false;
  };

  const processInvoiceLocally = async (file) => {
    try {
      const formData = new FormData();
      formData.append('invoice', file);

      const response = await fetch(`${API_BASE_URL}/invoices/upload`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        // Add the processed invoice to the list
        const processedInvoice = {
          id: result.id,
          processed_data: result.data,
          status: 'processed',
          created_at: new Date().toISOString()
        };
        setInvoices(prev => [processedInvoice, ...prev]);
        localStorage.setItem('invoices', JSON.stringify([processedInvoice, ...invoices]));
        alert('Invoice processed successfully!');
      } else {
        alert('Failed to process invoice. Please try again.');
      }
    } catch (error) {
      console.error('Processing error:', error);
      alert('Error processing invoice. Please check your connection.');
    }
  };

  const renderView = () => {
    // Handle invoice detail views
    if (currentView.startsWith('view-')) {
      const invoiceId = currentView.replace('view-', '');
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        return <InvoiceDetail
          invoice={invoice}
          onBack={() => setCurrentView('dashboard')}
          onEdit={() => setCurrentView('create')}
        />;
      }
      // If invoice not found, go back to dashboard
      setCurrentView('dashboard');
      return null;
    }

    switch (currentView) {
      case 'create':
        return <InvoiceCreator onSave={saveInvoice} onCancel={() => setCurrentView('dashboard')} />;
      case 'scan':
        return <InvoiceScanner onProcess={processInvoiceLocally} onCancel={() => setCurrentView('dashboard')} />;
      case 'list':
        return <InvoiceList invoices={invoices} onSelect={(id) => setCurrentView(`view-${id}`)} />;
      case 'dashboard':
      default:
        return <Dashboard
          invoices={invoices}
          isOnline={isOnline}
          onCreate={() => setCurrentView('create')}
          onList={() => setCurrentView('list')}
          onSelectInvoice={(id) => setCurrentView(`view-${id}`)}
        />;
    }
  };

  const toggleOffline = () => {
    setIsOnline(!isOnline);
  };

  return (
    <div className="App">
      <Header isOnline={isOnline} onToggleOffline={toggleOffline} />
      <Navigation currentView={currentView} onNavigate={setCurrentView} />
      <main className="App-main">
        {renderView()}
      </main>
    </div>
  );
}

function Header({ isOnline, onToggleOffline }) {
  return (
    <header className="App-header">
      <div className="header-content">
        <h1>🧾 Invoice Manager</h1>
        <div className="status-indicator">
          <span className={`status ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </span>
          <button
            onClick={onToggleOffline}
            className="offline-toggle-btn"
            title="Toggle offline mode for testing"
          >
            🔄
          </button>
        </div>
      </div>
    </header>
  );
}

function Navigation({ currentView, onNavigate }) {
  return (
    <nav className="App-nav">
      <button
        className={currentView === 'dashboard' ? 'active' : ''}
        onClick={() => onNavigate('dashboard')}
      >
        📊 Dashboard
      </button>
      <button
        className={currentView === 'create' ? 'active' : ''}
        onClick={() => onNavigate('create')}
      >
        ➕ Create Invoice
      </button>
      <button
        className={currentView === 'scan' ? 'active' : ''}
        onClick={() => onNavigate('scan')}
      >
        📷 Scan Invoice
      </button>
      <button
        className={currentView === 'list' ? 'active' : ''}
        onClick={() => onNavigate('list')}
      >
        📋 All Invoices
      </button>
    </nav>
  );
}

function Dashboard({ invoices, isOnline, onCreate, onList, onSelectInvoice }) {
  const totalInvoices = invoices.length;
  const totalAmount = invoices.reduce((sum, inv) => {
    const data = inv.processed_data || {};
    const amount = parseFloat(data.total_amount?.replace(/[^\d.]/g, '') || 0);
    return sum + amount;
  }, 0);

  return (
    <div className="dashboard">
      <div className="dashboard-stats">
        <div className="stat-card">
          <h3>{totalInvoices}</h3>
          <p>Total Invoices</p>
        </div>
        <div className="stat-card">
          <h3>${totalAmount.toFixed(2)}</h3>
          <p>Total Amount</p>
        </div>
        <div className="stat-card">
          <h3>{isOnline ? 'Connected' : 'Offline'}</h3>
          <p>Status</p>
        </div>
      </div>

      <div className="dashboard-actions">
        <button className="btn-primary" onClick={onCreate}>
          Create New Invoice
        </button>
        <button className="btn-secondary" onClick={onList}>
          View All Invoices
        </button>
      </div>

      <div className="recent-invoices">
        <h2>Recent Invoices</h2>
        {invoices.slice(0, 5).map(invoice => (
          <div
            key={invoice.id}
            className="invoice-summary clickable"
            onClick={() => onSelectInvoice && onSelectInvoice(invoice.id)}
          >
            <span>#{invoice.processed_data?.invoice_number || 'N/A'}</span>
            <span>{invoice.processed_data?.supplier_name || invoice.processed_data?.customer_name || 'Unknown'}</span>
            <span>${invoice.processed_data?.total_amount || '0'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvoiceCreator({ onSave, onCancel }) {
  const [step, setStep] = useState('create'); // 'create' or 'review'
  const [invoiceData, setInvoiceData] = useState({
    invoice_number: `INV-${Date.now()}`,
    current_date: new Date().toISOString().split('T')[0],
    due_date: '',
    currency: 'USD',
    bill_from: { name: '', email: '', address: '' },
    bill_to: { name: '', email: '', address: '' },
    items: [{ name: '', quantity: 1, rate: 0 }],
    tax_rate: 0,
    discount_rate: 0,
    notes: 'Thank you for your business!'
  });

  const addItem = () => {
    setInvoiceData({
      ...invoiceData,
      items: [...invoiceData.items, { name: '', quantity: 1, rate: 0 }]
    });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...invoiceData.items];
    newItems[index][field] = value;
    setInvoiceData({ ...invoiceData, items: newItems });
  };

  const removeItem = (index) => {
    if (invoiceData.items.length > 1) {
      const newItems = invoiceData.items.filter((_, i) => i !== index);
      setInvoiceData({ ...invoiceData, items: newItems });
    }
  };

  const calculateSubtotal = () => {
    return invoiceData.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  };

  const calculateTax = () => {
    return (calculateSubtotal() * invoiceData.tax_rate) / 100;
  };

  const calculateDiscount = () => {
    return (calculateSubtotal() * invoiceData.discount_rate) / 100;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax() - calculateDiscount();
  };

  const handleReview = () => {
    setStep('review');
  };

  const handleBackToEdit = () => {
    setStep('create');
  };

  const handleSave = async () => {
    const processedData = {
      ...invoiceData,
      subtotal: calculateSubtotal(),
      tax_amount: calculateTax(),
      discount_amount: calculateDiscount(),
      total_amount: calculateTotal().toFixed(2)
    };

    const success = await onSave({
      processed_data: processedData,
      status: 'created',
      created_at: new Date().toISOString()
    });

    if (success) {
      onCancel();
    }
  };

  const handleSendInvoice = () => {
    const subject = `Invoice ${invoiceData.invoice_number}`;
    const body = `Please find attached invoice ${invoiceData.invoice_number} for $${calculateTotal().toFixed(2)}`;
    const mailtoLink = `mailto:${invoiceData.bill_to.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
  };

  const handleDownloadPDF = async () => {
    const invoiceElement = document.getElementById('invoice-print');

    if (!invoiceElement) {
      alert('Invoice preview not found. Please try again.');
      return;
    }

    try {
      // Create canvas from the invoice element
      const canvas = await html2canvas(invoiceElement, {
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 800,
        height: invoiceElement.scrollHeight
      });

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      // Calculate dimensions to fit A4
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Download the PDF
      const fileName = `Invoice-${invoiceData.invoice_number}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  if (step === 'review') {
    return (
      <InvoiceReview
        invoiceData={{
          ...invoiceData,
          subtotal: calculateSubtotal(),
          tax_amount: calculateTax(),
          discount_amount: calculateDiscount(),
          total_amount: calculateTotal()
        }}
        onBack={handleBackToEdit}
        onSave={handleSave}
        onSend={handleSendInvoice}
        onDownload={handleDownloadPDF}
        onCancel={onCancel}
      />
    );
  }

  return (
    <div className="invoice-creator">
      <div className="invoice-form">
        {/* Invoice Header */}
        <div className="form-section">
          <h2>Invoice Details</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Invoice Number</label>
              <input
                type="text"
                value={invoiceData.invoice_number}
                onChange={(e) => setInvoiceData({...invoiceData, invoice_number: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Current Date</label>
              <input
                type="date"
                value={invoiceData.current_date}
                onChange={(e) => setInvoiceData({...invoiceData, current_date: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input
                type="date"
                value={invoiceData.due_date}
                onChange={(e) => setInvoiceData({...invoiceData, due_date: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Currency</label>
              <select
                value={invoiceData.currency}
                onChange={(e) => setInvoiceData({...invoiceData, currency: e.target.value})}
              >
                <option value="USD">USD ($)</option>
                <option value="BDT">BDT (৳)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bill From */}
        <div className="form-section">
          <h3>Bill From</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={invoiceData.bill_from.name}
                onChange={(e) => setInvoiceData({
                  ...invoiceData,
                  bill_from: {...invoiceData.bill_from, name: e.target.value}
                })}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={invoiceData.bill_from.email}
                onChange={(e) => setInvoiceData({
                  ...invoiceData,
                  bill_from: {...invoiceData.bill_from, email: e.target.value}
                })}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea
              value={invoiceData.bill_from.address}
              onChange={(e) => setInvoiceData({
                ...invoiceData,
                bill_from: {...invoiceData.bill_from, address: e.target.value}
              })}
            />
          </div>
        </div>

        {/* Bill To */}
        <div className="form-section">
          <h3>Bill To</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={invoiceData.bill_to.name}
                onChange={(e) => setInvoiceData({
                  ...invoiceData,
                  bill_to: {...invoiceData.bill_to, name: e.target.value}
                })}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={invoiceData.bill_to.email}
                onChange={(e) => setInvoiceData({
                  ...invoiceData,
                  bill_to: {...invoiceData.bill_to, email: e.target.value}
                })}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea
              value={invoiceData.bill_to.address}
              onChange={(e) => setInvoiceData({
                ...invoiceData,
                bill_to: {...invoiceData.bill_to, address: e.target.value}
              })}
            />
          </div>
        </div>

        {/* Items */}
        <div className="form-section">
          <h3>Items</h3>
          <div className="items-table">
            <div className="table-header">
              <span>Item Name</span>
              <span>Qty</span>
              <span>Rate</span>
              <span>Amount</span>
              <span>Action</span>
            </div>
            {invoiceData.items.map((item, index) => (
              <div key={index} className="table-row">
                <input
                  type="text"
                  placeholder="Item name"
                  value={item.name}
                  onChange={(e) => updateItem(index, 'name', e.target.value)}
                />
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.rate}
                  onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                />
                <span>${(item.quantity * item.rate).toFixed(2)}</span>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={invoiceData.items.length === 1}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="add-item-btn">
            ➕ Add Item
          </button>
        </div>

        {/* Calculations */}
        <div className="form-section calculations">
          <div className="calc-row">
            <span>Subtotal:</span>
            <span>${calculateSubtotal().toFixed(2)}</span>
          </div>
          <div className="calc-row">
            <label>Tax Rate (%):</label>
            <input
              type="number"
              min="0"
              max="100"
              value={invoiceData.tax_rate}
              onChange={(e) => setInvoiceData({...invoiceData, tax_rate: parseFloat(e.target.value) || 0})}
            />
            <span>${calculateTax().toFixed(2)}</span>
          </div>
          <div className="calc-row">
            <label>Discount Rate (%):</label>
            <input
              type="number"
              min="0"
              max="100"
              value={invoiceData.discount_rate}
              onChange={(e) => setInvoiceData({...invoiceData, discount_rate: parseFloat(e.target.value) || 0})}
            />
            <span>${calculateDiscount().toFixed(2)}</span>
          </div>
          <div className="calc-row total">
            <span>Total:</span>
            <span>${calculateTotal().toFixed(2)}</span>
          </div>
        </div>

        {/* Notes */}
        <div className="form-section">
          <h3>Notes</h3>
          <textarea
            value={invoiceData.notes}
            onChange={(e) => setInvoiceData({...invoiceData, notes: e.target.value})}
            placeholder="Thank you for your business!"
          />
        </div>

        {/* Actions */}
        <div className="form-actions">
          <button onClick={handleReview} className="btn-primary">
            👁️ Review Invoice
          </button>
          <button onClick={onCancel} className="btn-secondary">
            ❌ Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function InvoiceReview({ invoiceData, onBack, onSave, onSend, onDownload, onCancel }) {
  return (
    <div className="invoice-review">
      <div className="review-header">
        <h2>Review Invoice</h2>
        <div className="review-actions">
          <button onClick={onSend} className="btn-send">
            📧 Send Invoice
          </button>
          <button onClick={onDownload} className="btn-download">
            📄 Download PDF
          </button>
          <button onClick={onSave} className="btn-save">
            💾 Save Invoice
          </button>
          <button onClick={onBack} className="btn-edit">
            ✏️ Edit
          </button>
          <button onClick={onCancel} className="btn-cancel">
            ❌ Cancel
          </button>
        </div>
      </div>

      <div className="invoice-preview" id="invoice-print">
        {/* Invoice Header */}
        <div className="invoice-header-section">
          <div className="invoice-title">
            <h1>INVOICE</h1>
            <p>#{invoiceData.invoice_number}</p>
          </div>
          <div className="invoice-details">
            <div className="detail-row">
              <span className="label">Date of Issue:</span>
              <span className="value">{new Date(invoiceData.current_date).toLocaleDateString()}</span>
            </div>
            <div className="detail-row">
              <span className="label">Due Date:</span>
              <span className="value">{invoiceData.due_date ? new Date(invoiceData.due_date).toLocaleDateString() : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Billing Information */}
        <div className="billing-section">
          <div className="bill-from">
            <h3>Billed From</h3>
            <div className="billing-info">
              <p className="name">{invoiceData.bill_from.name || 'Your Company Name'}</p>
              <p>{invoiceData.bill_from.email}</p>
              <p>{invoiceData.bill_from.address.split('\n').map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}</p>
            </div>
          </div>
          <div className="bill-to">
            <h3>Billed To</h3>
            <div className="billing-info">
              <p className="name">{invoiceData.bill_to.name || 'Client Name'}</p>
              <p>{invoiceData.bill_to.email}</p>
              <p>{invoiceData.bill_to.address.split('\n').map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}</p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="items-section">
          <table className="items-table-print">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoiceData.items.map((item, index) => (
                <tr key={index}>
                  <td>{item.name || 'Item description'}</td>
                  <td>{item.quantity}</td>
                  <td>${item.rate.toFixed(2)}</td>
                  <td>${(item.quantity * item.rate).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="totals-section">
          <div className="totals-table">
            <div className="total-row">
              <span>Subtotal:</span>
              <span>${invoiceData.subtotal.toFixed(2)}</span>
            </div>
            {invoiceData.tax_rate > 0 && (
              <div className="total-row">
                <span>Tax ({invoiceData.tax_rate}%):</span>
                <span>${invoiceData.tax_amount.toFixed(2)}</span>
              </div>
            )}
            {invoiceData.discount_rate > 0 && (
              <div className="total-row">
                <span>Discount ({invoiceData.discount_rate}%):</span>
                <span>-${invoiceData.discount_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="total-row final">
              <span>Total:</span>
              <span>${invoiceData.total_amount.toFixed(2)}</span>
            </div>
            <div className="total-row amount-due">
              <span>Amount Due:</span>
              <span>${invoiceData.total_amount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoiceData.notes && (
          <div className="notes-section">
            <h4>Notes:</h4>
            <p>{invoiceData.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function InvoiceScanner({ onProcess, onCancel }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setIsProcessing(true);
      setProcessingStatus('Processing invoice...');

      try {
        await onProcess(file);
        setProcessingStatus('Invoice processed successfully!');
        setTimeout(() => {
          onCancel(); // Go back to dashboard
        }, 2000);
      } catch (error) {
        console.error('Processing failed:', error);
        setProcessingStatus('Processing failed. Please try again.');
        setTimeout(() => setProcessingStatus(''), 3000);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="invoice-scanner">
      <div className="scanner-content">
        <h2>📷 Scan or Upload Invoice</h2>
        <p>Upload an invoice image to automatically extract data using AI</p>

        <div className="upload-area">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={isProcessing}
            id="invoice-file"
            style={{ display: 'none' }}
          />
          <label htmlFor="invoice-file" className="upload-button">
            <div className="upload-icon">
              📎
            </div>
            <div className="upload-text">
              {selectedFile ? selectedFile.name : 'Choose Invoice Image'}
            </div>
            <div className="upload-hint">
              Supports JPG, PNG, PDF files
            </div>
          </label>
        </div>

        {isProcessing && (
          <div className="processing-status">
            <div className="spinner"></div>
            <p>{processingStatus}</p>
          </div>
        )}

        {!isProcessing && processingStatus && (
          <div className="success-message">
            ✅ {processingStatus}
          </div>
        )}

        <div className="scanner-info">
          <h3>💡 How it works:</h3>
          <ul>
            <li>Upload a clear image of your invoice</li>
            <li>AI extracts text and data automatically</li>
            <li>Review and edit extracted information</li>
            <li>Save to your invoice database</li>
          </ul>
        </div>

        <div className="scanner-actions">
          <button onClick={onCancel} className="btn-secondary">
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

function InvoiceDetail({ invoice, onBack, onEdit }) {
  const data = invoice.processed_data || {};

  const handleDownloadPDF = async () => {
    const invoiceElement = document.getElementById('invoice-detail-print');

    if (!invoiceElement) {
      alert('Invoice not found. Please try again.');
      return;
    }

    try {
      // Create canvas from the invoice element
      const canvas = await html2canvas(invoiceElement, {
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 800,
        height: invoiceElement.scrollHeight
      });

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      // Calculate dimensions to fit A4
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Download the PDF
      const fileName = `Invoice-${data.invoice_number || invoice.id}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const handleSendInvoice = () => {
    const subject = `Invoice ${data.invoice_number || invoice.id}`;
    const body = `Please find attached invoice ${data.invoice_number || invoice.id} for $${data.total_amount || '0'}`;
    const mailtoLink = `mailto:${data.bill_to?.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
  };

  return (
    <div className="invoice-detail">
      <div className="detail-header">
        <h2>Invoice Details</h2>
        <div className="detail-actions">
          <button onClick={handleSendInvoice} className="btn-send">
            📧 Send Invoice
          </button>
          <button onClick={handleDownloadPDF} className="btn-download">
            📄 Download PDF
          </button>
          <button onClick={onEdit} className="btn-edit">
            ✏️ Edit
          </button>
          <button onClick={onBack} className="btn-back">
            ← Back to Dashboard
          </button>
        </div>
      </div>

      <div className="invoice-preview" id="invoice-detail-print">
        {/* Invoice Header */}
        <div className="invoice-header-section">
          <div className="invoice-title">
            <h1>INVOICE</h1>
            <p>#{data.invoice_number || invoice.id}</p>
          </div>
          <div className="invoice-details">
            <div className="detail-row">
              <span className="label">Date of Issue:</span>
              <span className="value">{data.current_date ? new Date(data.current_date).toLocaleDateString() : new Date(invoice.created_at).toLocaleDateString()}</span>
            </div>
            <div className="detail-row">
              <span className="label">Due Date:</span>
              <span className="value">{data.due_date ? new Date(data.due_date).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="label">Status:</span>
              <span className="value">{invoice.status || 'Created'}</span>
            </div>
          </div>
        </div>

        {/* Billing Information */}
        <div className="billing-section">
          <div className="bill-from">
            <h3>Billed From</h3>
            <div className="billing-info">
              <p className="name">{data.bill_from?.name || data.supplier_name || 'Your Company Name'}</p>
              <p>{data.bill_from?.email || 'N/A'}</p>
              <p>{(data.bill_from?.address || data.supplier_address || '').split('\n').map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}</p>
            </div>
          </div>
          <div className="bill-to">
            <h3>Billed To</h3>
            <div className="billing-info">
              <p className="name">{data.bill_to?.name || data.customer_name || 'Client Name'}</p>
              <p>{data.bill_to?.email || 'N/A'}</p>
              <p>{(data.bill_to?.address || data.customer_address || '').split('\n').map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}</p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="items-section">
          <table className="items-table-print">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(data.items && data.items.length > 0) ? data.items.map((item, index) => (
                <tr key={index}>
                  <td>{item.name || 'Item description'}</td>
                  <td>{item.quantity || 1}</td>
                  <td>${Number(item.rate || 0).toFixed(2)}</td>
                  <td>${(Number(item.quantity || 1) * Number(item.rate || 0)).toFixed(2)}</td>
                </tr>
              )) : (
                <tr>
                  <td>Service/Item</td>
                  <td>1</td>
                  <td>${Number(data.total_amount || 0).toFixed(2)}</td>
                  <td>${Number(data.total_amount || 0).toFixed(2)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="totals-section">
          <div className="totals-table">
            <div className="total-row">
              <span>Subtotal:</span>
              <span>${Number(data.subtotal || data.total_amount || 0).toFixed(2)}</span>
            </div>
            {Number(data.tax_rate || 0) > 0 && (
              <div className="total-row">
                <span>Tax ({Number(data.tax_rate || 0)}%):</span>
                <span>${Number(data.tax_amount || 0).toFixed(2)}</span>
              </div>
            )}
            {Number(data.discount_rate || 0) > 0 && (
              <div className="total-row">
                <span>Discount ({Number(data.discount_rate || 0)}%):</span>
                <span>-${Number(data.discount_amount || 0).toFixed(2)}</span>
              </div>
            )}
            <div className="total-row final">
              <span>Total:</span>
              <span>${Number(data.total_amount || 0).toFixed(2)}</span>
            </div>
            <div className="total-row amount-due">
              <span>Amount Due:</span>
              <span>${Number(data.total_amount || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {(data.notes || invoice.extracted_text) && (
          <div className="notes-section">
            {data.notes && (
              <>
                <h4>Notes:</h4>
                <p>{data.notes}</p>
              </>
            )}
            {invoice.extracted_text && (
              <>
                <h4>Extracted Text:</h4>
                <pre className="extracted-text">{invoice.extracted_text}</pre>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InvoiceList({ invoices, onSelect }) {
  return (
    <div className="invoice-list">
      <h2>All Invoices</h2>
      <div className="invoices-grid">
        {invoices.map(invoice => (
          <div key={invoice.id} className="invoice-card" onClick={() => onSelect(invoice.id)}>
            <h3>#{invoice.processed_data?.invoice_number || 'N/A'}</h3>
            <p>{invoice.processed_data?.bill_to?.name || 'Unknown Client'}</p>
            <p className="amount">${invoice.processed_data?.total_amount || '0'}</p>
            <p className="date">{new Date(invoice.created_at).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
