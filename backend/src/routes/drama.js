const express = require('express');
const DramaController = require('../controllers/dramaController');

const router = express.Router();

router.get('/series', DramaController.listSeries);
router.get('/series/:id', DramaController.getSeriesDetail);
router.get('/series/:id/tree', DramaController.getDramaTree);

router.get('/node/:id', DramaController.getNodeDetail);

router.post('/options', DramaController.getBranchOptions);

router.post('/watch', DramaController.recordWatch);
router.get('/history', DramaController.getUserHistory);
router.get('/continue', DramaController.continueWatching);

module.exports = router;
