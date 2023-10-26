const MatchingStage = require('./matching-stage');
const {getStats: getTrackStats} = require('object-tracking-measure');
const {lastNonNull: getLastNonNull} = require('object-tracking-measure');
const applyMap = require('./matching-cascade/apply-map');
const matchStages = require('./utils/match-stages');
/**
* @typedef {Object} FinalStage
* @property {DistanceKey} distanceName the distance (in opts.distance) to use for the finalStage
* @property {Number} threshold threshold to apply on distance value
* @property {Number} age max age to apply this final stage
*/
class GlobalMatching {
	/**
	* Performs several matchingStages
	* @param {Object} options see MatchingStage
	* @param {Array.<FinalStage>} opts.finalStages see MatchingCasacade
	*/
	constructor(options) {
		const {stages, matchToTrackItem, age, distances, logger = console, getTime, trackFilter, logMessage} = options;

		// Super(options);
		const keys = Object.keys(distances);

		this.keys = keys;
		this.logger = logger;
		this.logMessage = logMessage;
		this.distances = distances;
		this.matchToTrackItem = matchToTrackItem;
		this.stages = stages;
		this.age = age;
		this.getTime = getTime;

		if (this.age) {
			const minCount = this.age.minCount || 1;

			this.trackFilter = function (track, index, {count, age, density, gapDensity}) {
				if ((age >= this.age.min && count <= minCount) || age > this.age.max) {
					return false;
				}

				if (typeof (this.age.densityThreshold) === 'number'	&& this.age.densityThreshold > density) {
					return false;
				}

				if (typeof (this.age.gapDensityThreshold) === 'number'	&& this.age.gapDensityThreshold < gapDensity && count > minCount) {
					return false;
				}

				return true;
			};
		} else if (trackFilter) {
			this.trackFilter = trackFilter;
		} else {
			throw (new Error('age or trackFilter must be defined'));
		}

		this.buildMatchingStages();
	}

	buildMatchingStages() {
		this.matchingStages = this.stages.map(stage => {
			return new MatchingStage(
				Object.assign({}, stage, {
					logger: this.logger,
					distances: this.distances,
					getTime: this.getTime,
					logMessage: this.logMessage
				})
			);
		});
	}

	/**
	* Call matchingCascade.match and run the finalStages detections
	* @overrides
	* @param {Array.<Track>} tracks
	* @param {Array.<Detection>} detections
	* @returns {MatchOutputDetailed}
	*/

	match(options) {
		return matchStages({...options, matchingStages: this.matchingStages});
	}

	// eslint-disable-next-line valid-jsdoc
	/**
	* This function translate the values of the matched objects so for each i
	* @alias MatchingStage.translateMatchIds
	*/
	static translateMatchIds(o) {
		return MatchingStage.translateMatchIds(o);
	}

	/**
	* Call the cascade macthing and update the tracks list for one iteration
	* @param {Array.<Track>} tracks
	* @param {Array.<Detection>} detections
	* @param {Number} iteration
	* @returns {Array.<Track>}
	*/
	iterTracks({
		tracks: originalTracks,
		detections,
		iteration,
		forceMatched = null
	}) {
		const tracks = originalTracks.concat();
		// First iteration with no tracks instantiated
		if (tracks.length === 0) {
			detections.forEach((detection, detectionId) => {
				const mapped = {};
				this.keys.forEach(k => {
					mapped[k] = {
						mappedTrack: null,
						mappedDetection: this.distances[k].mapDetection(detection)
					};
				});
				const trackItem = this.matchToTrackItem({
					track: null,
					detection,
					mapped,
					index: iteration,
					detectionId
				});
				const track = new Array(iteration).fill(0).map(() => null);
				track.push(trackItem);

				tracks.push(track);
			});
			return tracks;
		}

		// Console.log('iterTracks', iteration);

		const out = this.match({
			detections,
			context: {iteration},
			tracks
		});

		const {mappedTracks, mappedDetections} = out;
		let {matched, unmatchedDetectionIds, unmatchedTrackIds} = out;

		if (forceMatched) {
			matched = forceMatched;
			unmatchedDetectionIds = detections
				.map((_, detectionId) => detectionId)
				.filter(detectionId => !matched
					.map(({detectionId}) => detectionId).includes(detectionId)
				);

			unmatchedTrackIds = tracks
				.map((_, trackId) => trackId)
				.filter(trackId => !matched
					.map(({trackId}) => trackId).includes(trackId)
				);
		}

		unmatchedDetectionIds.forEach(detectionId => {
			if (mappedDetections[detectionId] === null) {
				mappedDetections[detectionId] = applyMap([detections[detectionId]], {distances: this.distances, fnName: 'mapDetection'});
			}

			const mapped = {};
			this.keys.forEach(k => {
				if (typeof (mappedDetections[detectionId][k]) === 'undefined') {
					mappedDetections[detectionId][k] = applyMap([detections[detectionId]], {distances: {[k]: this.distances[k]}, fnName: 'mapDetection'})[k];
				}

				mapped[k] = {
					mappedTrack: null,
					mappedDetection: mappedDetections[detectionId][k]
				};
			});
			const trackItem = this.matchToTrackItem({
				track: null,
				detection: detections[detectionId],
				mapped,
				index: iteration,
				detectionId
			});
			const track = new Array(iteration).fill(null).concat([trackItem]);
			tracks.push(track);
		});

		unmatchedTrackIds.forEach(trackId => {
			tracks[trackId].push(null);
		});

		matched.forEach(({detectionId, trackId}) => {
			const mapped = {};
			this.keys.forEach(k => {
				if (mappedDetections[detectionId] === null) {
					mappedDetections[detectionId] = {};
				}

				if (typeof (mappedDetections[detectionId][k]) === 'undefined') {
					mappedDetections[detectionId][k] = applyMap([detections[detectionId]], {distances: {[k]: this.distances[k]}, fnName: 'mapDetection'})[k];
				}

				if (mappedTracks[trackId] === null) {
					mappedTracks[trackId] = {};
				}

				if (typeof (mappedTracks[trackId][k]) === 'undefined' && tracks[trackId]) {
					const {value: lastNonNull, index: lastNonNullIndex} = getLastNonNull(tracks[trackId]);
					mappedTracks[trackId][k] = applyMap([tracks[trackId], trackId, lastNonNull, lastNonNullIndex], {distances: {[k]: this.distances[k]}, fnName: 'mapTrack'})[k];
				}

				mapped[k] = {
					mappedTrack: mappedTracks[trackId][k],
					mappedDetection: mappedDetections[detectionId][k]
				};
			});

			const trackItem = this.matchToTrackItem({
				track: tracks[trackId],
				detection: detections[detectionId],
				mapped,
				index: iteration,
				detectionId,
				trackId
			});

			tracks[trackId].push(trackItem);
		});
		return tracks;
	}

	/**
	* Check that all the tracks have the same size and return this size
	* @param {Array.<Track>} tracks
	* @returns {Number} iteration
	*/
	static getTracksIteration(tracks) {
		let iteration = 0;
		if (tracks.length > 0) {
			iteration = tracks[0].length;
		}

		tracks.forEach(t => {
			if (t.length !== iteration) {
				console.log({tracks, t});
				throw (new Error('Each input track should have same size'));
			}
		});

		return iteration;
	}

	/**
	* @typedef {Object} TrackOutput
	* @description output tracks from algorithm and list of tracks that are still active in the end of the algorithm
	* @property {Array.<Track>} tracks
	* @property {Array.<Number>} activeTrackIds
	*/

	/**
	* Build the track inrementally for each iteration and disable the track that match following conditions :
	* * age > this.age.max
	* * age > this.age.min and nonNull count === 1
	*
	* @param {Array.<Track>} [tracks = []]
	* @param {Array.<Array.<Detection>>} detectionsByIteration
	* @returns {TrackOutput}
	*/
	track({detectionsByIteration, tracks = []}) {
		let activeTrackIds = tracks.map((_, trackId) => trackId);

		detectionsByIteration.forEach(detections => {
			const itered = this.onlineTrack({
				detections,
				tracks,
				activeTrackIds
			});
			tracks = itered.tracks;
			activeTrackIds = itered.activeTrackIds;
		});

		return {tracks, activeTrackIds};
	}

	onlineTrack({detections, tracks, activeTrackIds}) {
		const iteration = this.constructor.getTracksIteration(tracks);
		const cTracks = tracks.concat();
		const newTracks = this.iterTracks({
			detections,
			iteration,
			tracks: activeTrackIds.map(trackId => tracks[trackId])
		});

		newTracks.forEach((nTrack, activeTrackIdIndex) => {
			if (typeof (activeTrackIds[activeTrackIdIndex]) !== 'number') {
				activeTrackIds[activeTrackIdIndex] = cTracks.length;
				cTracks.push(nTrack);
			}
		});

		const getTime = this.getTime;

		const toDeactivate = [];
		const updatedTracks = cTracks.map((t, trackIndex) => {
			const newTrackIndex = activeTrackIds.indexOf(trackIndex);
			if (newTrackIndex >= 0) {
				const track = newTracks[newTrackIndex];
				if (!this.trackFilter(track, trackIndex, getTrackStats({track, getTime}))) {
					toDeactivate.push(trackIndex);
				}

				return track;
			}

			return t.concat([null]);
		});

		const updatedActiveTrackIds = activeTrackIds.filter(a => !toDeactivate.includes(a));

		return {tracks: updatedTracks, activeTrackIds: updatedActiveTrackIds};
	}

	/**
	* @deprecated
	* @param {DistancesMapDefinition} distances
	* @param {Array.<Any>} tracks
	* @param {Array.<Any>} detections
	* @param {Object.<DistanceKey, Number>} [lambdas]
	* @param {Object.<DistanceKey, Number>} [thresholds]
	* @param {Array.<DistanceKey>} [order]
	* @returns {ValueAndGate}
	*/
	buildValueAndGate() {
		throw new Error('Deprecated, use tracker.matchingStages[0].buildValueAndGate');
	}

	/**
	* Get the details of the distances for given tracks
	*@param {Array.<NullableTrack>} tracks
	*@returns {Array.<DetailedDist>}
	*/
	getDetailedFramesInfo({tracks, matchingStage = this.matchingStages[0]}) {
		const maxFrame = Math.max(...tracks.map(track => getTrackStats({track, getTime: this.getTime}).lastIndex));
		const detailedFramesInfo = [];
		const distanceKeys = Object.keys(this.distances);
		const outputTracks = [];
		const outputTrackIds = [];
		for (let i = 0; i <= maxFrame; i++) {
			// Get the detections and activeTracks in frame
			const detectionIds = tracks
				.map((box, index) => ({value: box, index}))
				.filter(({value}) => {
					return value[i] !== null && typeof (value[i]) !== 'undefined';
				})
				.map(({index}) => index);

			const detectionsInFrame = detectionIds.map(dId => tracks[dId][i].detection);

			let frameInfo2 = matchingStage.getDetailedFrameInfo({
				detectionsInFrame,
				outputTracks
			});

			if (frameInfo2 === null) {
				frameInfo2 = {};
			}

			const extendedFrameInfo = Object.assign({}, frameInfo2, {
				inputTrackIds: tracks.map((_, trackId) => trackId),
				outputTrackIds: outputTrackIds.concat(),
				outputTracks: outputTracks.concat().map(a => a.concat()), // 2-level clone
				detectionIds
			});

			detailedFramesInfo.push(extendedFrameInfo);

			const {mappedTracks, mappedDetections} = extendedFrameInfo;

			const matchedLocalTrackIds = [];
			detectionIds.forEach((detectionId, localDId) => {
				let localTrackId = outputTrackIds.indexOf(detectionId);
				let track;
				let mappedTrack;
				let item;

				// Check if the track already exists
				if (localTrackId !== -1) {
					track = outputTracks[localTrackId];
					mappedTrack = mappedTracks[localTrackId];
					const mapped = {};
					distanceKeys.forEach(k => {
						mapped[k] = {
							mappedTrack: mappedTrack[k],
							mappedDetection: mappedDetections[localDId][k]
						};
					});
					item = this.matchToTrackItem({
						detection: detectionsInFrame[localDId],
						track,
						index: i,
						mapped
					});
				}

				if (localTrackId === -1) {
					const emptyTrack = new Array(i).fill(null);
					localTrackId = outputTracks.length;
					outputTracks.push(emptyTrack);
					outputTrackIds.push(detectionId);
					const mapped = {};
					distanceKeys.forEach(k => {
						mapped[k] = {
							mappedTrack: null,
							mappedDetection: mappedDetections[localDId][k]
						};
					});
					item = this.matchToTrackItem({
						detection: detectionsInFrame[localDId],
						track: null,
						index: i,
						mapped
					});
				}

				matchedLocalTrackIds.push(localTrackId);
				outputTracks[localTrackId].push(item);
			});
			outputTrackIds.forEach((_, localOutputTrackId) => {
				if (!matchedLocalTrackIds.includes(localOutputTrackId)) {
					outputTracks[localOutputTrackId].push(null);
				}
			});
		}

		return detailedFramesInfo;
	}

	getDetailedDist(options) {
		// Console.log('getDetailedDist', options)
		const framesInfo = this.getDetailedFramesInfo(options);
		const dists = [];
		framesInfo.forEach(({inputTrackIds, outputTrackIds, detectionIds, outputTracks, details, outputTrackFiltered}) => {
			if (outputTracks.length !== outputTrackIds.length) {
				throw (new Error('corrupted data'));
			}

			dists.push(inputTrackIds.map(trackId => {
				const localTrackIndex = outputTrackIds.findIndex(tId => tId === trackId);

				return inputTrackIds.map(detectionId => {
					const localDetectionIndex = detectionIds.findIndex(dId => dId === detectionId);
					if (localDetectionIndex === -1 || localTrackIndex === -1) {
						return null;
					}

					if (outputTrackFiltered[localTrackIndex]) {
						return null;
					}

					const age = Math.floor(getTrackStats({track: outputTracks[localTrackIndex], getTime: this.getTime}).age);

					details[localTrackIndex][localDetectionIndex].age = age;
					return details[localTrackIndex][localDetectionIndex];
				});
			}));
		});
		return dists;
	}
}

module.exports = GlobalMatching;
