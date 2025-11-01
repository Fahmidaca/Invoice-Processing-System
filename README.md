# 🧾 Invoice Manager - Complete Invoice Creation & Processing System

A comprehensive, offline-first invoice management platform designed for Bangladesh's SME sector, featuring full invoice creation, OCR processing, and intelligent data extraction with intermittent connectivity support.

## ✨ Features

### 📝 Invoice Creation
- **Complete Invoice Builder**: Create professional invoices with all standard fields
- **Dynamic Item Management**: Add/remove items with quantity, rate, and automatic calculations
- **Multi-Currency Support**: USD, BDT, EUR, GBP with proper formatting
- **Tax & Discount Calculations**: Automatic tax and discount rate calculations
- **Bill To/From**: Complete billing information with name, email, and address
- **Due Date Tracking**: Set and track invoice due dates
- **Custom Notes**: Add personalized thank you messages

### 🤖 AI-Powered Processing
- **Offline-First OCR**: Process invoices without internet using Tesseract.js
- **Intelligent Data Extraction**: Automatically parse invoice details from images
- **Background Synchronization**: Sync data when connectivity is restored
- **Real-time Status**: Live online/offline indicators

### 💼 Business Management
- **Dashboard Analytics**: Total invoices, amounts, and recent activity
- **Invoice History**: Complete list of all created and processed invoices
- **Status Tracking**: Monitor invoice creation and sync status
- **Professional Design**: Modern, responsive UI for desktop and mobile

### 🔄 Offline Capabilities
- **Local Storage**: IndexedDB for reliable offline data persistence
- **Background Sync**: Automatic data synchronization when online
- **Connectivity Awareness**: Smart handling of network status changes
- **Data Integrity**: Maintains data consistency across sessions

## Architecture

### Client (React PWA)
- **Frontend**: React with hooks for state management
- **OCR**: Tesseract.js for local text extraction
- **Storage**: IndexedDB for offline data persistence
- **Sync**: Background sync with Service Workers
- **UI**: Responsive design for desktop and mobile

### Server (Node.js/Express)
- **API**: RESTful endpoints for invoice processing
- **Database**: SQLite for data storage
- **OCR**: Tesseract.js for server-side processing
- **File Upload**: Multer for handling invoice images

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

1. **Clone and setup the project:**
   ```bash
   cd invoice-processing-system-design
   npm install
   ```

2. **Install client dependencies:**
   ```bash
   cd client
   npm install
   cd ..
   ```

3. **Install server dependencies:**
   ```bash
   cd server
   npm install
   cd ..
   ```

## Running the Application

1. **Start the server:**
   ```bash
   cd server
   npm start
   ```
   Server will run on http://localhost:5000

2. **Start the client (in a new terminal):**
   ```bash
   cd client
   npm start
   ```
   Client will run on http://localhost:3000

3. **Or run both simultaneously:**
   ```bash
   npm start
   ```

## Usage

### Creating Invoices
1. **Navigate to Create Invoice**: Click "➕ Create Invoice" from the dashboard
2. **Fill Invoice Details**: Enter invoice number, dates, currency, and billing information
3. **Add Items**: Use the dynamic item table to add products/services with quantities and rates
4. **Set Calculations**: Configure tax and discount rates for automatic calculations
5. **Add Notes**: Include custom notes like "Thank you for your business!"
6. **Review Invoice**: Click "👁️ Review Invoice" to preview the professional invoice
7. **Save or Send**: Save locally, send via email, or download as PDF

### Managing Invoices
1. **Dashboard**: View total invoices, amounts, and recent activity
2. **All Invoices**: Browse and search through all created invoices
3. **Offline Support**: All functionality works without internet (power cuts handled)
4. **Auto-Sync**: Data automatically syncs when connection is restored

### Bangladesh-Specific Features
- **Offline-First**: Handles 2-3 daily power outages seamlessly
- **Local Storage**: Data stays within Bangladesh borders
- **Cost-Effective**: Fits $15/month budget for 200-500 invoices
- **Multi-Device**: Works on desktop computers and mobile devices
- **Poor Quality Images**: OCR handles 60% handwritten/scanned documents

## API Endpoints

### Invoices
- `POST /api/invoices/upload` - Upload and process invoice
- `GET /api/invoices` - Get all invoices
- `GET /api/invoices/:id` - Get specific invoice
- `PUT /api/invoices/:id` - Update invoice data

### Suppliers
- `GET /api/suppliers` - Get all suppliers
- `POST /api/suppliers` - Add new supplier

### System
- `POST /api/sync` - Sync offline data
- `GET /api/health` - Health check

## Data Flow

### Online Mode
1. Invoice uploaded → Client OCR → Server processing → Database storage
2. Real-time sync with accounting software

### Offline Mode
1. Invoice uploaded → Local OCR → IndexedDB storage → Marked as pending
2. Background sync when online → Server processing → Database sync

## Technology Stack

### Frontend
- React 18
- Tesseract.js (OCR)
- IndexedDB (local storage)
- Service Workers (background sync)
- CSS3 with responsive design

### Backend
- Node.js
- Express.js
- SQLite3
- Multer (file uploads)
- Tesseract.js (OCR)

## Bangladesh-Specific Considerations

- **Data Privacy**: All data stays within Bangladesh (local hosting)
- **Intermittent Connectivity**: Offline-first design handles 40% unreliable internet
- **Power Outages**: Local processing survives 2-3 daily outages
- **Device Mix**: Works on desktop computers and mobile devices
- **Cost Constraints**: $15/month budget through efficient architecture

## Development

### Project Structure
```
invoice-processing-system-design/
├── client/                 # React PWA frontend
│   ├── src/
│   │   ├── App.js         # Main application component
│   │   ├── App.css        # Application styles
│   │   └── ...
│   └── package.json
├── server/                 # Node.js backend
│   ├── index.js           # Express server
│   └── package.json
├── solution.md            # Technical design document
├── blog-post.md           # LinkedIn blog post
└── README.md             # This file
```

### Building for Production

```bash
cd client
npm run build
```

The build artifacts will be stored in the `build/` directory.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support or questions, please contact the development team.

---

**DataSynthis Software Engineer Intern Task**
*Real-Time Invoice Processing System for Bangladesh's SME Sector*
