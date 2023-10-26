const fs = require('fs');
const test = require('ava');
const txt = fs.readFileSync('./test/data/vtracking_2021-10-05_R4C5_A_extract.jsonl').toString();
const frames = txt.split('\n').map(a => {
	if (a.trim() !== '') {
		return JSON.parse(a);
	}

	return null;
}).filter(a => a !== null);

const OnlineIdentity = require('../../../lib/post-processes/online-identity');

test('online-identity', t => {
	const trackIds = [];
	const tracks = [];
	frames.forEach((d, localFrameIndex) => {
		const {checkpoints} = d;
		checkpoints.forEach(c => {
			const {trackId} = c;
			const index = trackIds.indexOf(trackId);

			if (index === -1) {
				const track = new Array(localFrameIndex).fill(0).map(() => null);
				track.push(c);
				tracks.push(track);
				trackIds.push(trackId);
			} else {
				tracks[index].push(c);
			}
		});
	});
	tracks.forEach(track => {
		while (track.length < frames.length) {
			track.push(null);
		}
	});

	const onlineIdConf = require('../../helpers/torquator-20220622.js');

	const onlineIdentity = new OnlineIdentity(Object.assign({logger: console}, onlineIdConf));

	const {tracks: outTracks} = onlineIdentity.run({
		tracks,
		iterationInfos: frames.map(({frame}) => frame)
	});

	const {cost, weight} = outTracks.map(track => {
		track.forEach(item => {
			t.is(typeof (item), 'object');
			if (item && item.num) {
				t.is(typeof (item.num), 'object');
				t.is(typeof (item.num.confidence), 'number');
				t.is(typeof (item.num.value), 'number');
				t.is(typeof (item.num.opacity), 'number');
				t.is(typeof (item.num.capture), 'object');
			}
		});
		return ({
			cost: track.filter(item => item && item.num && (item.num.confidence === 0)).length,
			weight: track.filter(item => Boolean(item)).length
		});
	}).reduce((a, b) => ({cost: a.cost + b.cost, weight: a.weight + b.weight}));

	// console.log({cost, weight, score: cost / weight});

	t.true(Math.abs((cost / weight) - 0.554744) < 1e-2);
});
