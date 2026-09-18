const express = require('express');
const { Pool } = require('pg');
const path = require('path');
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL Connection Setup (Neon Cloud DB)
// Note: sslmode 'verify-full' suppresses pg-connection-string v9 deprecation warnings
// PostgreSQL Connection Setup (Neon Cloud DB)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { 
    rejectUnauthorized: false
  }
});

// Middleware
app.use(express.json());

// Serve static assets from public and root folders
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname)));

// Import separate route module for Order Requests (ord_req table)
let orderRequestsRouter;
try {
  orderRequestsRouter = require('./ordReq')(pool);
} catch (e) {
  try {
    orderRequestsRouter = require('./ordReq')(pool);
  } catch (err) {
    console.error('Could not load ordReq route module:', err.message);
  }
}

if (orderRequestsRouter) {
  app.use('/api/order-requests', orderRequestsRouter);
  app.use('/api/ord-req', orderRequestsRouter);
}

const serveIndexHtml = (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, 'index.html'));
    }
  });
};

// ==========================================================
// 1. STOCK MAST ENDPOINTS
// ==========================================================

app.get('/api/stock-view', async (req, res) => {
  try {
    const query = `
      SELECT 
        it_code,
        it_desc,
        item_cat,
        item_size,
        it_unit,
        item_type,
        stock_in_hnd,
        reorderlevel,
        open_stock,
        fowd_qty,
        dayopenbal,
        dayclosebal,
        it_uprise_pur,
        it_uprise_sal,
        open_stock_date,
        proces_date,
        last_purch_date,
        rack_no,
        user_name,
        softdrbeer,
        mapit_code,
        td_special,
        pic_link,
        remarks,
        CASE 
          WHEN stock_in_hnd <= 0 THEN 'OUT OF STOCK'
          WHEN stock_in_hnd <= reorderlevel THEN 'LOW STOCK'
          ELSE 'IN STOCK'
        END AS stock_status
      FROM stock_mast
      ORDER BY it_code ASC, item_size ASC
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching stock view:', err);
    res.status(500).json({ error: 'Failed to retrieve stock data' });
  }
});

app.post('/api/stock', async (req, res) => {
  const {
    it_code, it_desc, item_cat, item_size, it_unit, item_type,
    stock_in_hnd, reorderlevel, open_stock, fowd_qty, dayopenbal,
    dayclosebal, it_uprise_pur, it_uprise_sal, open_stock_date,
    proces_date, last_purch_date, rack_no, user_name, softdrbeer,
    mapit_code, td_special, pic_link, remarks
  } = req.body;

  if (!it_code) {
    return res.status(400).json({ error: 'Item Code (it_code) is required' });
  }

  try {
    const insertQuery = `
      INSERT INTO stock_mast (
        it_code, it_desc, item_cat, item_size, it_unit, item_type,
        stock_in_hnd, reorderlevel, open_stock, fowd_qty, dayopenbal,
        dayclosebal, it_uprise_pur, it_uprise_sal, open_stock_date,
        proces_date, last_purch_date, rack_no, user_name, softdrbeer,
        mapit_code, td_special, pic_link, remarks
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24
      )
    `;

    const values = [
      it_code, it_desc || null, item_cat || null, item_size || '',
      it_unit || null, item_type || null, stock_in_hnd ?? 0,
      reorderlevel ?? 0, open_stock ?? 0, fowd_qty || null,
      dayopenbal ?? 0, dayclosebal ?? 0, it_uprise_pur ?? 0,
      it_uprise_sal ?? 0, open_stock_date || null, proces_date || null,
      last_purch_date || null, rack_no || null, user_name || null,
      softdrbeer || null, mapit_code || null, td_special || null,
      pic_link || null, remarks || null
    ];

    await pool.query(insertQuery, values);
    res.status(201).json({ success: true, message: 'Stock item added successfully' });
  } catch (err) {
    console.error('Error adding stock item:', err);
    res.status(500).json({ error: 'Failed to add stock item' });
  }
});

app.put('/api/stock/:it_code/:item_size', async (req, res) => {
  const { it_code, item_size } = req.params;
  const {
    it_desc, item_cat, item_size: newSize, it_unit, item_type,
    stock_in_hnd, reorderlevel, open_stock, fowd_qty, dayopenbal,
    dayclosebal, it_uprise_pur, it_uprise_sal, open_stock_date,
    proces_date, last_purch_date, rack_no, user_name, softdrbeer,
    mapit_code, td_special, pic_link, remarks
  } = req.body;

  try {
    const updateQuery = `
      UPDATE stock_mast 
      SET 
        it_desc = $1, item_cat = $2, item_size = $3, it_unit = $4,
        item_type = $5, stock_in_hnd = $6, reorderlevel = $7,
        open_stock = $8, fowd_qty = $9, dayopenbal = $10,
        dayclosebal = $11, it_uprise_pur = $12, it_uprise_sal = $13,
        open_stock_date = $14, proces_date = $15, last_purch_date = $16,
        rack_no = $17, user_name = $18, softdrbeer = $19,
        mapit_code = $20, td_special = $21, pic_link = $22, remarks = $23
      WHERE it_code = $24 AND item_size = $25
    `;

    const values = [
      it_desc || null, item_cat || null, newSize || item_size,
      it_unit || null, item_type || null, stock_in_hnd ?? 0,
      reorderlevel ?? 0, open_stock ?? 0, fowd_qty || null,
      dayopenbal ?? 0, dayclosebal ?? 0, it_uprise_pur ?? 0,
      it_uprise_sal ?? 0, open_stock_date || null, proces_date || null,
      last_purch_date || null, rack_no || null, user_name || null,
      softdrbeer || null, mapit_code || null, td_special || null,
      pic_link || null, remarks || null, it_code, item_size
    ];

    const result = await pool.query(updateQuery, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Item variant not found' });
    }

    res.json({ success: true, message: 'Stock item updated successfully' });
  } catch (err) {
    console.error('Error updating stock item:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

app.delete('/api/stock/:it_code/:item_size', async (req, res) => {
  const { it_code, item_size } = req.params;

  try {
    const deleteQuery = `DELETE FROM stock_mast WHERE it_code = $1 AND item_size = $2`;
    const result = await pool.query(deleteQuery, [it_code, item_size]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Item variant not found' });
    }

    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// ==========================================================
// 2. ORDER REQUEST ENDPOINTS (ord_req table)
// ==========================================================

app.get('/api/ord-req', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM ord_req ORDER BY req_date DESC, req_no DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching ord_req:', err);
    res.status(500).json({ error: 'Failed to fetch order requests' });
  }
});

app.post('/api/ord-req', async (req, res) => {
  const { req_no, req_date, table_no, it_code, it_desc, item_size, req_qty, it_unit, teleno, status, req_ok, remarks } = req.body;
  
  const isOk = req_ok ?? false;
  const initialTimeOk = isOk ? new Date() : null;

  try {
    const query = `
      INSERT INTO ord_req (req_no, req_date, table_no, it_code, it_desc, item_size, req_qty, it_unit, teleno, status, req_ok, time_ok, remarks)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `;
    const values = [
      req_no, 
      req_date || new Date(), 
      table_no || null, 
      it_code, 
      it_desc || null, 
      item_size || null, 
      req_qty || 1, 
      it_unit || null, 
      teleno || null, 
      status || 'PENDING', 
      isOk, 
      initialTimeOk,
      remarks || null
    ];
    await pool.query(query, values);
    res.status(201).json({ success: true, message: 'Order request created' });
  } catch (err) {
    console.error('Error creating ord_req:', err);
    res.status(500).json({ error: 'Failed to create order request' });
  }
});

const handleOrdReqUpdate = async (req, res) => {
  const { 
    req_no, req_date, table_no, it_code, it_desc, 
    item_size, req_qty, it_unit, teleno, status, req_ok, remarks,
    user_name, steward_name 
  } = req.body;

  const targetReqNo = req.params.req_no || req_no;
  const targetItCode = req.params.it_code || it_code;
  const targetItemSize = req.params.item_size || item_size;

  if (!targetReqNo) {
    return res.status(400).json({ error: 'Order request number (req_no) is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const parsedQty = !isNaN(parseFloat(req_qty)) ? parseFloat(req_qty) : 1;

    let parsedDate = null;
    if (req_date && !isNaN(Date.parse(req_date))) {
      parsedDate = new Date(req_date);
    }

    const isOk = typeof req_ok === 'boolean' 
      ? req_ok 
      : (req_ok === 'true' || req_ok === 1 || req_ok === '1');

    // 1. Check stock_mast for item_type and route to kot or boc accordingly
    if (targetItCode) {
      const stockResult = await client.query(
        'SELECT item_type FROM stock_mast WHERE it_code = $1 AND ($2::text IS NULL OR item_size = $2::text)',
        [targetItCode, targetItemSize || null]
      );

      if (stockResult.rows.length > 0) {
        const itemType = stockResult.rows[0].item_type;
        if (itemType) {
          const lowerType = itemType.toLowerCase();
          if (lowerType === 'kic') {
            const kotNo = 'KOT-' + Date.now();
            await client.query(
              `INSERT INTO "kot" (kot_no, kot_date, kot_date1, table_no, it_code, item_size, qty, it_desc, creatbill, user_name, steward_name, repprinted)
               VALUES ($1, NOW(), CURRENT_DATE, $2, $3, $4, $5, $6, false, $7, $8, false)`,
              [kotNo, table_no || null, targetItCode, targetItemSize || '', parsedQty, it_desc || null, user_name || null, steward_name || null]
            );
          } else if (lowerType === 'bar') {
            const bocNo = 'BOC-' + Date.now();
            await client.query(
              `INSERT INTO "boc" (boc_no, boc_date, boc_date1, table_no, it_code, item_size, qty, it_desc, creatbill, user_name, steward_name, repprinted)
               VALUES ($1, NOW(), CURRENT_DATE, $2, $3, $4, $5, $6, false, $7, $8, false)`,
              [bocNo, table_no || null, targetItCode, targetItemSize || '', parsedQty, it_desc || null, user_name || null, steward_name || null]
            );
          }
        }
      }
    }

    // Fetch existing row to manage time_ok timestamp accurately
    const existingRowQuery = await client.query(
      `SELECT req_ok, time_ok FROM ord_req 
       WHERE req_no = $1 
         AND ($2::text IS NULL OR it_code = $2::text OR it_code IS NULL)
         AND ($3::text IS NULL OR item_size = $3::text OR item_size IS NULL)
       LIMIT 1`,
      [targetReqNo, targetItCode || null, targetItemSize || null]
    );

    let finalTimeOk = null;
    if (existingRowQuery.rows.length > 0) {
      const currentReqOk = existingRowQuery.rows[0].req_ok;
      const currentTimeOk = existingRowQuery.rows[0].time_ok;

      if (isOk) {
        finalTimeOk = !currentReqOk || !currentTimeOk ? new Date() : currentTimeOk;
      } else {
        finalTimeOk = null;
      }
    }

    // 2. Update ord_req status/fields
    const query = `
      UPDATE ord_req 
      SET 
        req_date = COALESCE($1, req_date), 
        table_no = $2, 
        it_desc = $3, 
        item_size = $4, 
        req_qty = $5, 
        it_unit = $6, 
        teleno = $7, 
        status = $8, 
        req_ok = $9, 
        time_ok = $10,
        remarks = $11
      WHERE req_no = $12 
        AND ($13::text IS NULL OR it_code = $13::text OR it_code IS NULL)
        AND ($14::text IS NULL OR item_size = $14::text OR item_size IS NULL)
    `;

    const values = [
      parsedDate, 
      table_no || null, 
      it_desc || null, 
      targetItemSize || null, 
      parsedQty, 
      it_unit || null, 
      teleno || null, 
      status || 'PENDING', 
      isOk, 
      finalTimeOk,
      remarks || null, 
      targetReqNo, 
      targetItCode || null,
      targetItemSize || null
    ];

    const result = await client.query(query, values);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order request not found or no rows altered' });
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Order request updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('FULL DATABASE ERROR UPDATING ORD_REQ:', err);
    res.status(500).json({ error: 'Failed to update order request', details: err.message });
  } finally {
    client.release();
  }
};

app.put('/api/ord-req', handleOrdReqUpdate);
app.put('/api/ord-req/:req_no', handleOrdReqUpdate);
app.put('/api/ord-req/:req_no/:it_code', handleOrdReqUpdate);
app.put('/api/ord-req/:req_no/:it_code/:item_size', handleOrdReqUpdate);

const handleOrdReqDelete = async (req, res) => {
  const { req_no, it_code, item_size } = req.params;
  try {
    const query = `
      DELETE FROM ord_req 
      WHERE req_no = $1 
        AND ($2::text IS NULL OR it_code = $2::text)
        AND ($3::text IS NULL OR item_size = $3::text)
    `;
    const result = await pool.query(query, [req_no, it_code || null, item_size || null]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Order request not found' });
    }
    res.json({ success: true, message: 'Order request deleted successfully' });
  } catch (err) {
    console.error('Error deleting ord_req:', err);
    res.status(500).json({ error: 'Failed to delete order request' });
  }
};

app.delete('/api/ord-req/:req_no', handleOrdReqDelete);
app.delete('/api/ord-req/:req_no/:it_code', handleOrdReqDelete);
app.delete('/api/ord-req/:req_no/:it_code/:item_size', handleOrdReqDelete);

// ==========================================================
// 3. FRONTEND ROUTES
// ==========================================================
app.get('/', serveIndexHtml);

// Express wildcard routing parameter syntax
app.get('/*splat', serveIndexHtml);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful pool connection cleanup
let isPoolEnded = false;
const shutdownPool = async () => {
  if (!isPoolEnded) {
    isPoolEnded = true;
    try {
      await pool.end();
    } catch (e) {
      // Ignore if pool is already closed
    }
  }
};

process.once('SIGTERM', shutdownPool);
process.once('SIGINT', shutdownPool);

module.exports = app;