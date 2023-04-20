const test = require('ava');
// Const boxToXYPosition = require('@alezanai/belley-rush');
const AbstractMatchingStage = require('../../lib/abstract-matching-stage.js');
const iou = require('mean-average-precision').iou;
const {getStats: getTrackStats} = require('object-tracking-measure');
const keysEqual = function (t, object1, object2) {
	Object.keys(object1).forEach(k => {
		if (typeof (object2[k]) !== 'undefined') {
			t.is(object1[k], object2[k]);
		}
	});
};

const toIouFormat = o => {
	if (o) {
		const [left, top, width, height] = o;
		return ({left, top, right: left + width, bottom: top + height});
	}

	return null;
};

// Global variables useful for the tests
const iouDistance = {
	fn: (mappedTrack, mappedDetection) => {
		if (mappedTrack && mappedDetection) {
			return (1 - iou(mappedTrack, mappedDetection));
		}

		return 1;
	},
	mapTrack: (track, _, lastNonNull) => toIouFormat(lastNonNull),
	mapDetection: detection => toIouFormat(detection.box)
};

const simpleOptions = {
	distances: {
		iou: iouDistance
	},
	lambdas: {
		iou: 1
	},
	thresholds: {
		iou: 0.5
	}
};

const simpleSituation = {
	tracks: [[
		[0, 0, 200, 200],
		null
	], [
		[0, 0, 190, 190],
		[0, 0, 190, 190]
	]],
	detections: [
		{box: [0, 0, 200, 200], nonMaxSupprDistThreshold: 0.3},
		{box: [10, 10, 180, 180], nonMaxSupprDistThreshold: 1}
	]
};
test('No filter', t => {
	const stage = new AbstractMatchingStage(simpleOptions);

	const {matched: matchesSimple} = stage.match(simpleSituation);
	t.is(matchesSimple.length, 2);
	keysEqual(t, matchesSimple[0], {detectionId: 0, trackId: 0, detectionValue: 1, trackValue: 1});
	keysEqual(t, matchesSimple[1], {detectionId: 1, trackId: 1, detectionValue: 1, trackValue: 1});
});

test('SortTracks', t => {
	const stageSortTracks = new AbstractMatchingStage(Object.assign({}, simpleOptions, {
		trackSortKey: (track => Math.floor(getTrackStats({track}).age))
	}));
	const {matched: matchesSortTracks} = stageSortTracks.match(simpleSituation);

	t.is(matchesSortTracks.length, 2);

	keysEqual(t, matchesSortTracks[0], {detectionId: 0, trackId: 1, detectionValue: 1, trackValue: 0});
	keysEqual(t, matchesSortTracks[1], {detectionId: 1, trackId: 0, detectionValue: 1, trackValue: 1});
});

test('filter tracks', t => {
	const stage = new AbstractMatchingStage(Object.assign({}, simpleOptions, {
		trackSortKey: (track => Math.floor(getTrackStats({track}).age) >= 1 ? null : 1)
	}));
	const {matched} = stage.match(simpleSituation);
	t.is(matched.length, 1);
	keysEqual(t, matched[0], {detectionId: 0, trackId: 1, detectionValue: 1, trackValue: 1});
});

test('SortDetections', t => {
	const stage = new AbstractMatchingStage(Object.assign({}, simpleOptions, {
		detectionSortKey: (detection => detection.nonMaxSupprDistThreshold > 0.5 ? 0 : 1)
	}));

	const {matched} = stage.match(simpleSituation);

	t.is(matched.length, 2);
	keysEqual(t, matched[0], {detectionId: 1, trackId: 1, detectionValue: 0, trackValue: 1});
	keysEqual(t, matched[1], {detectionId: 0, trackId: 0, detectionValue: 1, trackValue: 1});
});

test('FilterDetections', t => {
	const stage = new AbstractMatchingStage(Object.assign({}, simpleOptions, {
		detectionSortKey: (detection => detection.nonMaxSupprDistThreshold > 0.5 ? 1 : null)
	}));
	const {matched} = stage.match(simpleSituation);

	t.is(matched.length, 1);
	keysEqual(t, matched[0], {detectionId: 1, trackId: 1, detectionValue: 1, trackValue: 1});
});

const complexSituation1 = {
	tracks: [[
		[0, 0, 200, 200],
		null
	], [
		[0, 0, 190, 190],
		[0, 0, 190, 190]
	]],
	detections: [
		{box: [0, 0, 200, 200], nonMaxSupprDistThreshold: 0.3},
		{box: [10, 10, 180, 180], nonMaxSupprDistThreshold: 1},
		{box: [12, 12, 180, 180], nonMaxSupprDistThreshold: 1}
	]
};
const complexSituation2 = {
	tracks: [[
		[0, 0, 200, 200],
		null
	], [
		[0, 0, 190, 190],
		[0, 0, 190, 190]
	], [
		[0, 0, 210, 210],
		[0, 0, 210, 210]
	]],
	detections: [
		{box: [0, 0, 200, 200], nonMaxSupprDistThreshold: 0.3},
		{box: [10, 10, 180, 180], nonMaxSupprDistThreshold: 1}
	]
};

test('SortTracks and Detections', t => {
	const stage = new AbstractMatchingStage(Object.assign({}, simpleOptions, {
		trackSortKey: (track => Math.floor(getTrackStats({track}).age)),
		detectionSortKey: (detection => detection.nonMaxSupprDistThreshold > 0.5 ? 0 : 1)
	}));

	const {matched: matched1} = stage.match(complexSituation1);
	const {matched: matched2} = stage.match(complexSituation2);

	t.is(matched1.length, 2);
	t.is(matched2.length, 2);

	keysEqual(t, matched1[0], {detectionId: 1, trackId: 1, detectionValue: 0, trackValue: 0});
	keysEqual(t, matched2[0], {detectionId: 1, trackId: 1, detectionValue: 0, trackValue: 0});
	keysEqual(t, matched1[1], {detectionId: 2, trackId: 0, detectionValue: 0, trackValue: 1});
	keysEqual(t, matched2[1], {detectionId: 0, trackId: 2, detectionValue: 1, trackValue: 0});
});
