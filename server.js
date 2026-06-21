// BULK UPDATE: Works for ALL heads - standard + custom
app.put('/fee-structure/bulk-update-head', verifyToken, isAdmin, async (req, res) => {
  try {
    const { headType, name, amount } = req.body;
    const standardHeads = ['tuition','registration','exam','diary','cardBoard'];

    if (standardHeads.includes(headType)) {
      await FeeStructure.updateMany({}, { [headType]: Number(amount) });
      const updateObj = {};
      updateObj[`ledger.${headType}`] = Number(amount);
      await Student.updateMany({}, { $set: updateObj });
      res.json({ message: `${headType} updated to ₹${amount} for all classes` });
    } else if (name) {
      await FeeStructure.updateMany(
        { 'otherHeads.name': name },
        { $set: { 'otherHeads.$.amount': Number(amount) } }
      );
      await Student.updateMany(
        { 'ledger.otherHeads.name': name },
        { $set: { 'ledger.otherHeads.$.amount': Number(amount) } }
      );
      res.json({ message: `"${name}" updated to ₹${amount} for all classes` });
    } else {
      res.status(400).json({ error: 'Invalid request' });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// RENAME FUND: Works for custom heads only
app.put('/fee-structure/rename-head', verifyToken, isAdmin, async (req, res) => {
  try {
    const { oldName, newName, isStandard } = req.body;
    if (!oldName ||!newName) return res.status(400).json({ error: 'Both names required' });

    if (isStandard) {
      return res.status(400).json({ error: `Cannot rename standard head "${oldName}". Create new custom head instead.` });
    } else {
      await FeeStructure.updateMany(
        { 'otherHeads.name': oldName },
        { $set: { 'otherHeads.$.name': newName } }
      );
      await Student.updateMany(
        { 'ledger.otherHeads.name': oldName },
        { $set: { 'ledger.otherHeads.$.name': newName } }
      );
      await Student.updateMany(
        { 'payments.head': oldName },
        { $set: { 'payments.$.head': newName } }
      );
    }
    res.json({ message: `Renamed "${oldName}" to "${newName}" everywhere` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
