const express = require('express');
const middlewares = require('../helpers/middlewares');
const Logger = require('../models/log');
const osuBot = require('../helpers/osuBot');
const User = require('../models/user');

const router = express.Router();

router.use(middlewares.isLoggedIn);
router.use(middlewares.hasFullReadAccess);

router.post('/sendMessages', middlewares.isResponsibleWithButtons, async (req, res) => {
    let messages = req.body.lines.filter(l => l.length);

    if (!messages.length) {
        return res.json({ error: 'No messages' });
    }

    let users = [];

    const splitIds = req.body.users.split('\n');
    const unfilteredOsuIds = splitIds.filter(id => id.length);
    const osuIds = [...new Set(unfilteredOsuIds)];

    if (!osuIds.length) {
        return res.json({ error: 'No users' });
    }

    for (const osuId of osuIds) {
        const id = parseInt(osuId);

        if (isNaN(id)) {
            return res.json({ error: `User "${osuId}" wasn't found. Make sure it's an osu ID, not a username` });
        }

        users.push({ osuId: id });
    }

    let newMessages;

    // send to all users
    for (const user of users) {
        newMessages = await osuBot.sendMessages(user.osuId, messages);
    }

    // sent to self for reference
    await osuBot.sendMessages(req.session.osuId, messages);

    if (newMessages !== true) {
        return res.json({ error: `Messages were not sent. Please let pishifat know!` });
    }

    res.json({ success: 'Messages sent! A copy was sent to you for confirmation' });

    Logger.generate(
        req.session.mongoId,
        `Spammed messages through u/mappersguild`,
        'spam',
        null
    );
});

/* GET user osu! IDs */
router.get('/findUserOsuIds/:group/:mode', async (req, res) => {
    let users;
    const group = req.params.group;
    const mode = req.params.mode;

    if (group !== 'all' && mode !== 'all') {
        users = await User
            .find({
                modesInfo: { $elemMatch: { mode } },
                groups: { $in: [group] },
            });
    } else if (group !== 'all' && mode == 'all') {
        users = await User
            .find({
                groups: { $in: [group] },
            });
    } else if (group == 'all' && mode !== 'all') {
        users = await User
            .find({
                modesInfo: { $elemMatch: { mode } },
            });
    } else if (group == 'all' && mode == 'all') {
        users = await User
            .find({
                groups: { $in: ['bn', 'nat'] },
            });
    }

    const userOsuIds = users.map(u => u.osuId);

    res.json(userOsuIds);
});

module.exports = router;
