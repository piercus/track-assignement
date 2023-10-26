const {mapMatrix} = require('simple-linalg');
const {transpose} = require('simple-linalg');
// Const ([a-zA-Z]+) = require\('./linalg/([a-zA-Z]+).js'\);
const munkres = require('munkres-js');
const buildValueAndGate = require('./matching-cascade/build-value-and-gate');
const uniq = array => array.filter((a, index) => array.indexOf(a) === index);
const flatten = array => array.reduce((a, b) => a.concat(b));
const translateMatchIds = require('./utils/translate-match-ids');

class AbstractMatchingStage {
	/**
	* Instanciate the Cascade
	* Check that the resuired keys are present in the obj, and only those keys
	* raise an error using 'label' as the name of the object
	* @param {Object.<DistanceKey, DistanceDefinition>} distance object to check
	* @param {Object.<DistanceKey, Number>} thresholds object to check
	* @param {Object.<DistanceKey, Number>} lambdas object to check
	* @param {MatchToTrackItemCallback} matchToTrackItem used to build a track from a match
	* @param {Array.<String>} keys required keys
	* @param {AgeOption} age
	* @param {Logger} logger required keys
	* @param {String} label functional name of obj
	*/
	constructor({distances, order, trackSortKey = (() => 1), detectionSortKey = (() => 1), lambdas = null, thresholds, logger = console, getTime, logMessage = null}) {
		// If (typeof (matchToTrackItem) !== 'function') {
		// 	matchToTrackItem = ({detection}) => detection;
		// }

		// Logger.debug(`detectionReceiverMatching starts`)
		if (!order) {
			order = Object.keys(thresholds);
		}

		const keys = Object.keys(distances);
		this.keys = keys;
		this.logger = logger;
		this.distances = distances;
		this.order = order;
		this.lambdas = lambdas;
		this.thresholds = thresholds;
		this.getTime = getTime;

		this.trackSortKey = trackSortKey;
		this.detectionSortKey = detectionSortKey;
		this.logMessage = logMessage;
		// Sanity check
		this.constructor.checkObjectKeys({obj: this.thresholds, label: 'thresholds', keys: this.keys, mandatory: false});
		this.constructor.checkObjectKeys({obj: this.distances, label: 'distances', keys: this.keys});
		this.constructor.checkObjectKeys({obj: this.thresholds, label: 'order', keys: order});
		this.constructor.checkObjectKeys({obj: this.lambdas, label: 'lambdas', keys: this.keys, mandatory: false});
	}

	/**
	* Check that the resuired keys are present in the obj, and only those keys
	* raise an error using 'label' as the name of the object
	* @param {Object.<DistanceKey, Any>} obj object to check
	* @param {Array.<DistanceKey>} keys required keys
	* @param {String} label functional name of obj
	* @returns {Null}
	*/
	static checkObjectKeys({obj, label, keys, mandatory = true}) {
		if (typeof (obj) !== 'object') {
			if (mandatory) {
				throw (new Error(`${label}'s is not an object'`));
			} else {
				return;
			}
		}

		const objectKeys = Object.keys(obj);
		objectKeys.forEach(key => {
			if (!keys.includes(key)) {
				throw (new Error(`Stage configuration : ${label}'s key ${key} is not in keys ${keys.join(',')}`));
			}
		});
		keys.forEach(key => {
			if (!objectKeys.includes(key) && mandatory) {
				throw (new Error(`Stage configuration : key ${key} is not in ${label}`));
			}
		});
	}

	/**
	* @param {DistancesMapDefinition} distances
	* @param {Array.<Any>} tracks
	* @param {Array.<Any>} detections
	* @param {Object.<DistanceKey, Number>} lambdas
	* @param {Object.<DistanceKey, Number>} thresholds
	* @param {Array.<DistanceKey>} order
	* @returns {ValueAndGate}
	*/
	buildValueAndGate({
		tracks,
		detections,
		context,
		logMessage = null,
		distances = null,
		thresholds = null,
		order = null
	}) {
		if (!distances) {
			distances = this.distances;
		}

		if (!thresholds) {
			thresholds = this.thresholds;
		}

		if (!order) {
			order = this.order;
		}

		if (!logMessage) {
			logMessage = this.logMessage;
		}

		return buildValueAndGate({
			tracks,
			detections,
			keys: this.keys,
			distances,
			order,
			logger: this.logger,
			thresholds,
			lambdas: this.lambdas,
			logMessage,
			context
		});
	}
	/**
	* @typedef {Object} (Match)Output
	* @property {Array.<Match>} matched
	* @property {Array.<Any>} mappedTracks
	* @property {Array.<Any>} mappedDetections
	*/

	/**
	* Implement the matching using matrixes of gate and values
	* @param {Array.<Track>} tracks
	* @param {Array.<Detection>} detections
	* @param {DistancesMapDefinition} distances
	* @param {Object.<DistanceKey, Number>} thresholds
	* @param {Array.<DistanceKey>} order
	* @returns {MatchOutput}
	*/

	matchOneValue({tracks, detections, distances, thresholds, order, context}) {
		const {
			gate,
			value,
			details,
			mappedTracks,
			mappedDetections
		} = this.buildValueAndGate({
			tracks,
			detections,
			distances,
			order,
			thresholds,
			context
		});

		// Check that there is no null mappedTracks

		if (mappedTracks.filter(t => t !== null).length !== tracks.length) {
			throw (new Error('Lengths not matching'));
		}

		const matched = this.buildMatched({
			gate,
			value,
			details,
			context
		});

		return {
			matched,
			mappedTracks,
			mappedDetections
		};
	}

	buildMatched({
		gate,
		value,
		details,
		context
	}) {
		const valueMatrix = value;

		const matched = [];

		// We only keep the tracks that have at least one detection over the threshold
		const rowFilteredIndexes = mapMatrix(gate, (value, trackId, detectionId) => ({value, trackId, detectionId}))
			.filter(row => row.filter(({value}) => value).length > 0);

		// If there is no track under the thresholds, then no match
		if (rowFilteredIndexes.length === 0) {
			return matched;
		}

		// Let's remove the detection that have no match with tracks
		const filteredIndexes = transpose(transpose(rowFilteredIndexes).filter(row => row.filter(({value}) => value).length > 0));

		const trackIds = uniq(flatten(
			mapMatrix(filteredIndexes, ({trackId}) => trackId)
		));

		const detectionIds = uniq(flatten(
			mapMatrix(filteredIndexes, ({detectionId}) => detectionId)
		));

		// Shrink the valueMatrix to the non-removed tracks and detections
		const filteredValue = valueMatrix
			.filter((row, trackId) =>
				trackIds
					.includes(trackId)
			)
			.map(row =>
				row.filter((_, detectionId) =>
					detectionIds.includes(detectionId)
				)
			);

		const hungarian = munkres(filteredValue);
		const blocked = [];

		hungarian.forEach(([rIndex, cIndex]) => {
			const trackId = trackIds[rIndex];
			const detectionId = detectionIds[cIndex];
			const m = Object.assign({}, details[trackId][detectionId], {
				trackId,
				detectionId
			});
			if (gate[trackId] && gate[trackId][detectionId] === true) {
				matched.push(m);
			} else if (gate[trackId] && (gate[trackId][detectionId] === false)) {
				blocked.push(m);
				Object.keys(details[trackId][detectionId].values).forEach(k => {
					if (details[trackId][detectionId].thresholds[k] < details[trackId][detectionId].values[k]) {
						this.logger.debug(`Gate[${trackId}][${detectionId}] is blocking matching (value ${k}: ${details[trackId][detectionId].values[k]} > ${details[trackId][detectionId].thresholds[k]})`);
					}
				});
			}
		});

		if (this.logMessage) {
			const message = this.logMessage({matched, value, details, context, blocked});
			if (typeof (message) === 'string') {
				this.logger.info(message);
			}
		}

		return matched;
	}

	getSorted(els, fn) {
		const elsBySortValues = {};
		const removed = [];
		els
			.map((t, index) => ({sortValue: fn(t, index), index}))
			.forEach(({sortValue, index}) => {
				if (typeof (sortValue) === 'number') {
					if (!elsBySortValues[sortValue]) {
						elsBySortValues[sortValue] = [];
					}

					elsBySortValues[sortValue].push(index);
				} else {
					removed.push(index);
				}
			});

		const sortValues = Object.keys(elsBySortValues).map(n => Number.parseInt(n, 10)).sort((a, b) => a - b);
		return {
			sorted: sortValues.map(value => {
				if (Number.isNaN(value)) {
					throw new TypeError('NaN value');
				}

				return {
					value,
					indexes: elsBySortValues[value]
				};
			}),
			removed
		};
	}

	/**
	* @typedef {MatchOutput} MatchOutputDetailed
	* @property {Array.<Number>} unmatchedTrackIds
	* @property {Array.<Number>} unmatchedDetectionIds
	*/
	/**
	* Implement the cascade through different tracks's age
	* @param {Array.<Track>} tracks
	* @param {Array.<Detection>} detections
	* @returns {MatchOutputDetailed}
	*/
	match({detections, tracks, context}) {
		let matched = [];
		const mappedTracks = new Array(tracks.length).fill(null);
		const mappedDetections = new Array(detections.length).fill(null);

		const unmatchedTrackIds = [];
		let unmatchedDetectionIds = [];
		const {sorted: sortedTrackIndexes, removed: removedTrackIndexes} = this.getSorted(tracks, this.trackSortKey);
		const {sorted: sortedDetectionIndexes, removed: removedDetectionIndexes} = this.getSorted(detections, this.detectionSortKey);

		const remainingSortedTrackIndexes = sortedTrackIndexes.concat();
		// Console.log(allAges, tracks.map(track => getTrackStats({track, ageRatio})))
		// We only keep the ages under maxAge
		sortedDetectionIndexes.forEach(({indexes: initDetectionIds, value: detectionValue}, detectionGroupIndex) => {
			let unmatchedByValueDetectionIds = initDetectionIds;
			const unmatchedByDetectionValueTrackIds = remainingSortedTrackIndexes.concat();
			unmatchedByDetectionValueTrackIds.forEach(({indexes: trackIndexes, value: trackValue}, trackGroupIndex) => {
				const localTracks = trackIndexes.map(trackId => tracks[trackId]);
				// Console.log({sortValue, floorAges, detections: unmatchedDetectionIds.map(detectionId => detections[detectionId]).length})
				const {
					matched: localSortValueMatched,
					mappedTracks: localSortValueMappedTracks,
					mappedDetections: localSortValueMappedDetections
				} = this.matchOneValue({
					tracks: localTracks,
					detections: unmatchedByValueDetectionIds.map(detectionId => detections[detectionId]),
					context: Object.assign({}, context, {detectionGroupIndex, trackGroupIndex})
				});

				// Translate to the corresponding id in global tracks
				trackIndexes.forEach((trackId, index) => {
					if (localSortValueMappedTracks && localSortValueMappedTracks[index]) {
						mappedTracks[trackId] = localSortValueMappedTracks[index];
					}
				});

				unmatchedByValueDetectionIds.forEach((detectionId, index) => {
					if (localSortValueMappedDetections && localSortValueMappedDetections[index]) {
						mappedDetections[detectionId] = localSortValueMappedDetections[index];
					}
				});
				const {
					matched: localMatched,
					unmatchedDetectionIds: unmatchedLocalDetectionIds,
					unmatchedTrackIds: unmatchedLocalTrackIds
				} = this.constructor.translateMatchIds({
					localMatched: localSortValueMatched,
					localTrackIds: trackIndexes,
					localDetectionIds: unmatchedByValueDetectionIds
				});

				localMatched.forEach(matched => {
					matched.detectionValue = detectionValue;
					matched.trackValue = trackValue;
				});

				matched = matched.concat(localMatched);
				remainingSortedTrackIndexes[trackGroupIndex].indexes = unmatchedLocalTrackIds;
				unmatchedByValueDetectionIds = unmatchedLocalDetectionIds;
			});
			unmatchedDetectionIds = unmatchedDetectionIds.concat(unmatchedByValueDetectionIds);
		});

		if (matched.map(({trackId}) => mappedTracks[trackId]).filter(t => t === null).length > 0) {
			throw (new Error('Invalid mappedTracks content in matchingStage'));
		}

		return {matched, unmatchedDetectionIds, removedDetectionIndexes, unmatchedTrackIds, removedTrackIndexes, mappedTracks, mappedDetections};
	}

	/**
		* This function translate the values of the matched objects so for each i
		* output.matched[i].trackId = localTrackIds[localMatched[i].trackId]
		* output.matched[i].detectionId = localDetectionIds[localMatched[i].detectionId]
		* @param {Array.<Matched>} localMatched
		* @param {Array.<Number>} localTrackIds
		* @param {Array.<Number>} localDetectionIds
		* @returns {MatchOutputDetailed} output
		*/
	static translateMatchIds(o) {
		return translateMatchIds(o);
	}

	/**
	* Get the details of the distances for given tracks
	*@param {Array.<NullableTrack>} tracks
	*@returns {Array.<DetailedDist>}
	*/
	getDetailedFrameInfo({
		detectionsInFrame,
		outputTracks,
		context
	}) {
		if (detectionsInFrame.length === 0) {
			return null;
		}

		// Build value matrix
		const {details, mappedTracks, mappedDetections} = this.buildValueAndGate({
			tracks: outputTracks,
			detections: detectionsInFrame,
			context
		});

		const outputTrackSortKeys = outputTracks.map(t => this.trackSortKey(t));
		const outputTrackFiltered = outputTrackSortKeys.map(n => typeof (n) !== 'number');
		// Console.log(outputTrackSortKeys)
		return {
			details,
			outputTrackFiltered,
			mappedTracks,
			mappedDetections
		};
	}
}

module.exports = AbstractMatchingStage;
