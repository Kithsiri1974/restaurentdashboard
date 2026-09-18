const express = require('express');

module.exports = function (pool) {
  const router = express.Router();

  // Root GET - Sorted descending by req_date, with req_no DESC as a stable fallback
  router.get('/', async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM ord_req ORDER BY req_date DESC, req_no DESC');
      res.json(rows);
    } catch (err) {
      console.error('Error fetching ord_req:', err);
      res.status(500).json({ error: 'Failed to fetch order requests' });
    }
  });

  // Root POST (req_date and time_ok are handled here initially)
  router.post('/', async (req, res) => {
    const { req_no, req_date, table_no, it_code, it_desc, item_size, req_qty, qty, it_unit, teleno, req_ok, remarks } = req.body;
    const finalQty = qty !== undefined ? qty : (req_qty || 1);
    const isOk = req_ok ?? false;
    
    const initialTimeOk = isOk ? new Date() : null;

    try {
      const query = `
        INSERT INTO ord_req (req_no, req_date, table_no, it_code, it_desc, item_size, qty, it_unit, teleno, req_ok, time_ok, remarks)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;
      await pool.query(query, [
        req_no, 
        req_date || new Date(), 
        table_no || null, 
        it_code, 
        it_desc || null, 
        item_size || null, 
        finalQty, 
        it_unit || null, 
        teleno || null, 
        isOk, 
        initialTimeOk,
        remarks || null
      ]);
      res.status(201).json({ success: true, message: 'Order request created' });
    } catch (err) {
      console.error('Error creating ord_req:', err);
      res.status(500).json({ error: 'Failed to create order request' });
    }
  });

  // Helper handler for PUT updates
  const handleUpdate = async (req, res) => {
    const { 
      req_no, table_no, it_code, it_desc, 
      item_size, req_qty, qty, it_unit, teleno, req_ok, remarks,
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

      const finalQty = !isNaN(parseFloat(qty ?? req_qty)) ? parseFloat(qty ?? req_qty) : 1;

      const isOk = typeof req_ok === 'boolean' 
        ? req_ok 
        : (req_ok === 'true' || req_ok === 1 || req_ok === '1');

      let derivedStatus = 'PENDING';

      // Check stock_mast and insert into kot, boc, or tak tables including req_no
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
              derivedStatus = 'Kitchen';
              const kotNo = 'K' + Date.now().toString().slice(-9);
              await client.query(
                `INSERT INTO "kot" (kot_no, kot_date, kot_date1, table_no, it_code, item_size, qty, it_desc, creatbill, user_name, steward_name, repprinted, req_no)
                 VALUES ($1, NOW(), CURRENT_DATE, $2, $3, $4, $5, $6, false, $7, $8, false, $9)
                 ON CONFLICT (kot_no) DO NOTHING`,
                [kotNo, table_no || null, targetItCode, targetItemSize || '', finalQty, it_desc || null, user_name || null, steward_name || null, targetReqNo]
              );
            } else if (lowerType === 'bar') {
              derivedStatus = 'Bar';
              const bocNo = 'B' + Date.now().toString().slice(-9);
              await client.query(
                `INSERT INTO "boc" (boc_no, boc_date, boc_date1, table_no, it_code, item_size, qty, it_desc, creatbill, user_name, steward_name, repprinted, req_no)
                 VALUES ($1, NOW(), CURRENT_DATE, $2, $3, $4, $5, $6, false, $7, $8, false, $9)
                 ON CONFLICT (boc_no) DO NOTHING`,
                [bocNo, table_no || null, targetItCode, targetItemSize || '', finalQty, it_desc || null, user_name || null, steward_name || null, targetReqNo]
              );
            } else if (lowerType === 'tak') {
              derivedStatus = 'Take';
              const takNo = 'T' + Date.now().toString().slice(-9);
              await client.query(
                `INSERT INTO "tak" (tak_no, tak_date, tak_date1, table_no, it_code, item_size, qty, it_desc, creatbill, user_name, steward_name, repprinted, req_no)
                 VALUES ($1, NOW(), CURRENT_DATE, $2, $3, $4, $5, $6, false, $7, $8, false, $9)
                 ON CONFLICT (tak_no) DO NOTHING`,
                [takNo, table_no || null, targetItCode, targetItemSize || '', finalQty, it_desc || null, user_name || null, steward_name || null, targetReqNo]
              );
            }
          }
        }
      }

      // Fetch current row to check existing req_ok value
      const existingRowQuery = await client.query(
        `SELECT req_ok, time_ok FROM ord_req 
         WHERE req_no = $1 
           AND ($2::text IS NULL OR it_code = $2::text)
           AND ($3::text IS NULL OR item_size = $3::text)
         LIMIT 1`,
        [targetReqNo, targetItCode || null, targetItemSize || null]
      );

      let finalTimeOk = null;
      if (existingRowQuery.rows.length > 0) {
        const currentReqOk = existingRowQuery.rows[0].req_ok;
        const currentTimeOk = existingRowQuery.rows[0].time_ok;

        if (isOk) {
          finalTimeOk = !currentReqOk || !currentTimeOk ? new Date() : currentTimeOk;
          
          // Optionally, if the row already existed in kot/boc/tak prior to this update, ensure req_no is synced there too:
          await client.query(`UPDATE kot SET req_no = $1 WHERE it_code = $2 AND table_no = $3 AND (req_no IS NULL OR req_no = '')`, [targetReqNo, targetItCode, table_no]);
          await client.query(`UPDATE boc SET req_no = $1 WHERE it_code = $2 AND table_no = $3 AND (req_no IS NULL OR req_no = '')`, [targetReqNo, targetItCode, table_no]);
          await client.query(`UPDATE tak SET req_no = $1 WHERE it_code = $2 AND table_no = $3 AND (req_no IS NULL OR req_no = '')`, [targetReqNo, targetItCode, table_no]);
        } else {
          finalTimeOk = null;
        }
      }

      // Update ord_req fields 
      const query = `
        UPDATE ord_req 
        SET 
          table_no = $1, 
          it_desc = $2, 
          item_size = $3, 
          qty = $4, 
          it_unit = $5, 
          teleno = $6, 
          status = $7, 
          req_ok = $8, 
          time_ok = $9,
          remarks = $10
        WHERE req_no = $11 
          AND ($12::text IS NULL OR it_code = $12::text)
          AND ($13::text IS NULL OR item_size = $13::text)
      `;

      const values = [
        table_no || null, 
        it_desc || null, 
        targetItemSize || null, 
        finalQty, 
        it_unit || null, 
        teleno || null, 
        derivedStatus, 
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

  // Attach PUT routes
  router.put('/', handleUpdate);
  router.put('/:req_no', handleUpdate);
  router.put('/:req_no/:it_code', handleUpdate);
  router.put('/:req_no/:it_code/:item_size', handleUpdate);

  // Attach DELETE routes
  const handleDelete = async (req, res) => {
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

  router.delete('/:req_no', handleDelete);
  router.delete('/:req_no/:it_code', handleDelete);
  router.delete('/:req_no/:it_code/:item_size', handleDelete);

  return router;
};