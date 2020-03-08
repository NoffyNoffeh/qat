const express = require('express');
const api = require('../helpers/api');
const helpers = require('../helpers/helpers');
const vetoesService = require('../models/veto').service;
const User = require('../models/user');
const mediationsService = require('../models/mediation').service;
const logsService = require('../models/log').service;

const router = express.Router();

const defaultPopulate = [
    { populate: 'vetoer', display: 'username osuId' },
    { innerPopulate: 'mediations', populate: { path: 'mediator', select: 'username osuId' } },
];

router.use(api.isLoggedIn);
router.use(api.isBnOrNat);

/* GET bn app page */
router.get('/', (req, res) => {
    res.render('vetoes', {
        title: 'Vetoes',
        script: '../javascripts/vetoes.js',
        isVetoes: true,
        isBn: res.locals.userRequest.isBn,
        isNat: res.locals.userRequest.group == 'nat' || res.locals.userRequest.isSpectator,
    });
});

/* GET applicant listing. */
router.get('/relevantInfo', async (req, res) => {
    let v = await vetoesService.query({}, defaultPopulate, { createdAt: -1 }, true);
    res.json({
        vetoes: v,
        userId: req.session.mongoId,
        isNat: res.locals.userRequest.group == 'nat' || res.locals.userRequest.isSpectator,
        userOsuId: req.session.osuId,
    });
});

/* POST create a new veto. */
router.post('/submit', api.isNotSpectator, async (req, res) => {
    let url = req.body.discussionLink;

    if (url.length == 0) {
        url = undefined;
    }

    const validUrl = helpers.isValidUrl(url, 'osu.ppy.sh/beatmapsets');
    if (validUrl.error) return res.json(validUrl.error);

    let indexStart = url.indexOf('beatmapsets/') + 'beatmapsets/'.length;
    let indexEnd = url.indexOf('#');
    let bmId;

    if (indexEnd !== -1) {
        bmId = url.slice(indexStart, indexEnd);
    } else {
        bmId = url.slice(indexStart);
    }

    const bmInfo = await api.beatmapsetInfo(bmId);

    if (!bmInfo || bmInfo.error) {
        return res.json(bmInfo);
    }

    let v = await vetoesService.create(
        req.session.mongoId,
        req.body.discussionLink,
        bmInfo.beatmapset_id,
        bmInfo.artist + ' - ' + bmInfo.title,
        bmInfo.creator,
        bmInfo.creator_id,
        req.body.shortReason,
        req.body.mode
    );
    v = await vetoesService.query({ _id: v._id }, defaultPopulate);
    res.json(v);
    logsService.create(req.session.mongoId, `Submitted a veto for mediation on "${v.beatmapTitle}"`);
    api.webhookPost([{
        author: {
            name: `${req.session.username}`,
            icon_url: `https://a.ppy.sh/${req.session.osuId}`,
            url: `https://osu.ppy.sh/users/${req.session.osuId}`,
        },
        color: '16731997',
        fields: [
            {
                name: `https://bn.mappersguild.com/vetoes?beatmap=${v.id}`,
                value: `Submitted veto on **${v.beatmapTitle}** by **${v.beatmapMapper}**`,
            },
        ],
    }],
    req.body.mode);
});

/* POST set status upheld or withdrawn. */
router.post('/selectMediators', api.isNat, api.isNotSpectator, async (req, res) => {
    let allUsers;

    try {
        allUsers = await User.getAllMediators();
    } catch (error) {
        return { error: error._message };
    }

    let usernames = [];

    for (let i = 0; i < allUsers.length; i++) {
        let user = allUsers[i];

        if (
            (user.modes.indexOf(req.body.mode) >= 0 || req.body.mode == 'all') &&
            !user.probation.length &&
            req.body.excludeUsers.indexOf(user.username.toLowerCase()) < 0
        ) {
            usernames.push(user);

            if (usernames.length >= (req.body.mode == 'osu' || req.body.mode == 'all' ? 11 : 5)) {
                break;
            }
        }
    }

    res.json(usernames);
});

/* POST begin mediation */
router.post('/beginMediation/:id', api.isNat, api.isNotSpectator, async (req, res) => {
    for (let i = 0; i < req.body.mediators.length; i++) {
        let mediator = req.body.mediators[i];
        let m = await mediationsService.create(mediator._id);
        await vetoesService.update(req.params.id, { $push: { mediations: m }, status: 'wip' });
    }

    let date = new Date();
    date.setDate(date.getDate() + 7);
    await vetoesService.update(req.params.id, { deadline: date });
    let v = await vetoesService.query({ _id: req.params.id }, defaultPopulate);
    res.json(v);
    logsService.create(
        req.session.mongoId,
        `Started veto mediation for "${v.beatmapTitle}"`
    );
    api.webhookPost([{
        author: {
            name: `${req.session.username}`,
            icon_url: `https://a.ppy.sh/${req.session.osuId}`,
            url: `https://osu.ppy.sh/users/${req.session.osuId}`,
        },
        color: '12858015',
        fields: [
            {
                name: `https://bn.mappersguild.com/vetoes?beatmap=${v.id}`,
                value: `Started veto mediation on **${v.beatmapTitle}** by **${v.beatmapMapper}**`,
            },
        ],
    }],
    v.mode);
});

/* POST submit mediation */
router.post('/submitMediation/:id', api.isNotSpectator, async (req, res) => {
    let originalMediation = await mediationsService.query({ _id: req.body.mediationId });
    await mediationsService.update(req.body.mediationId, { comment: req.body.comment, vote: req.body.vote });
    let v = await vetoesService.query({ _id: req.params.id }, defaultPopulate);
    res.json(v);
    logsService.create(
        req.session.mongoId,
        'Submitted vote for a veto'
    );

    if (!originalMediation.comment.length) {
        api.webhookPost([{
            author: {
                name: `${req.session.username}`,
                icon_url: `https://a.ppy.sh/${req.session.osuId}`,
                url: `https://osu.ppy.sh/users/${req.session.osuId}`,
            },
            color: '10895161',
            fields: [
                {
                    name: `https://bn.mappersguild.com/vetoes?beatmap=${v.id}`,
                    value: `Submitted opinion on veto for **${v.beatmapTitle}** by **${v.beatmapMapper}**`,
                },
            ],
        }],
        v.mode);
    }
});

/* POST conclude mediation */
router.post('/concludeMediation/:id', api.isNat, api.isNotSpectator, async (req, res) => {
    if (req.body.dismiss || !req.body.majority) {
        await vetoesService.update(req.params.id, { status: 'withdrawn' });
    } else {
        await vetoesService.update(req.params.id, { status: 'upheld' });
    }

    let v = await vetoesService.query({ _id: req.params.id }, defaultPopulate);
    res.json(v);
    logsService.create(
        req.session.mongoId,
        `Veto ${v.status.charAt(0).toUpperCase() + v.status.slice(1)} for "${v.beatmapTitle}" ${req.body.dismiss ? 'without mediation' : ''}`
    );
    api.webhookPost([{
        author: {
            name: `${req.session.username}`,
            icon_url: `https://a.ppy.sh/${req.session.osuId}`,
            url: `https://osu.ppy.sh/users/${req.session.osuId}`,
        },
        color: '5118500',
        fields: [
            {
                name: `https://bn.mappersguild.com/vetoes?beatmap=${v.id}`,
                value: `Concluded veto mediation for **${v.beatmapTitle}** by **${v.beatmapMapper}**`,
            },
        ],
    }],
    v.mode);
});

/* POST continue mediation */
router.post('/continueMediation/:id', api.isNat, api.isNotSpectator, async (req, res) => {
    await vetoesService.update(req.params.id, { status: 'wip' });
    let v = await vetoesService.query({ _id: req.params.id }, defaultPopulate);
    res.json(v);
    logsService.create(
        req.session.mongoId,
        `Veto mediation for "${v.beatmapTitle}" re-initiated`
    );
});

/* POST replace mediator */
router.post('/replaceMediator/:id', api.isNat, api.isNotSpectator, async (req, res) => {
    let v = await vetoesService.query({ _id: req.params.id }, defaultPopulate);
    let currentMediators = [];

    v.mediations.forEach(mediation => {
        currentMediators.push(mediation.mediator.osuId);
    });

    let newMediator;

    if (v.mode === 'all') {
        newMediator = await User.aggregate([
            { $match: { osuId: { $nin: currentMediators }, vetoMediator: true } },
            { $sample: { size: 1 } },
        ]);
    } else {
        newMediator = await User.aggregate([
            { $match: { modes: v.mode, osuId: { $nin: currentMediators }, probation: { $ne: v.mode }, vetoMediator: true } },
            { $sample: { size: 1 } },
        ]);
    }

    let oldMediation = await mediationsService.query({ _id: req.body.mediationId }, [{ populate: 'mediator', display: 'username' }]);
    await mediationsService.update(req.body.mediationId, { mediator: newMediator[0]._id });
    let newMediation = await mediationsService.query({ _id: req.body.mediationId }, [{ populate: 'mediator', display: 'username' }]);

    v = await vetoesService.query({ _id: req.params.id }, defaultPopulate);
    res.json(v);

    logsService.create(
        req.session.mongoId,
        'Re-selected a single veto mediator'
    );
    api.webhookPost([{
        author: {
            name: `${req.session.username}`,
            icon_url: `https://a.ppy.sh/${req.session.osuId}`,
            url: `https://osu.ppy.sh/users/${req.session.osuId}`,
        },
        color: '7347001',
        fields: [
            {
                name: `https://bn.mappersguild.com/vetoes?beatmap=${v.id}`,
                value: `Replaced **${oldMediation.mediator.username}** with **${newMediation.mediator.username}** as mediator for veto on **${v.beatmapTitle}** by **${v.beatmapMapper}**`,
            },
        ],
    }],
    v.mode);
});

module.exports = router;
