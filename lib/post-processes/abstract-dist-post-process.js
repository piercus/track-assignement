const AbstractPostProcess = require('./abstract-post-process');
const setDistances = require('../utils/set-distances');
const distancesTrack2trackModules = require('../distances/track2track');
const {lastNonNull: getLastNonNull} = require('object-tracking-measure');
const uniq = array => array.filter((a, index) => array.indexOf(a) === index);
/**
 * Abstract class for distance-based post-processing of tracks.
 * @abstract
 * @extends AbstractPostProcess
 */
class AbstractDistPostProcess extends AbstractPostProcess {
	/**
	 * Creates an instance of AbstractDistPostProcess.
	 * @param {Object} options - The options object.
	 * @param {Object} options.tracker - The tracker instance.
	 * @param {Object} options.distanceConfs - The distance configurations object.
	 * @param {Array} options.stages - The stages array.
	 * @throws {Error} Throws an error if trackItemToDetection is not provided.
	 * @throws {TypeError} Throws a type error if stages is not an array.
	 */
	constructor(options) {
		super(options);
		const {tracker, distanceConfs, stages} = options;

		if (!tracker || !tracker.trackItemToDetection) {
			throw (new Error('trackItemToDetection is mandatory'));
		}

		this.tracker = tracker;
		this.trackItemToDetection = tracker.trackItemToDetection;
		if (distanceConfs) {
			this.distances = setDistances({distanceConfs, distanceModules: distancesTrack2trackModules, glConf: options.distanceSharedConf});
			Object.keys(this.distances).forEach(k => {
				if (!this.distances[k].mapDetection && this.distances[k].mapTrack) {
					const mapTrack = this.distances[k].mapTrack;
					this.distances[k].mapDetection = function (track, trackId) {
						const {value: lastNonNull, index: lastNonNullIndex} = getLastNonNull(track);
						return mapTrack(track, trackId, lastNonNull, lastNonNullIndex);
					};
				}
			});
		} else {
			throw (new Error('distanceConfs is mandatory'));
		}

		if (!Array.isArray(stages)) {
			throw (new TypeError('stages is mandatory'));
		}

		this.stages = options.stages;
	}

	/**
	 * Returns an array of scene IDs by active track.
	 * @param {Object} options - The options object.
	 * @param {Array.<String>} options.sceneIds - The scene IDs array of size nFrames
	 * @param {Array.<Array.<Detection | Null>>} options.tracks - The tracks object of size nTracks x nFrames
	 * @param {Array.<Number>} options.activeTrackIds - The active track IDs array, each item is a number < nTracks
	 * @returns {Array} Returns an array of scene IDs by active track (size activeTracks.length)
	 * @throws {Error} Throws an error if sceneIds is empty.
	 */
	getSceneIdsByActiveTrack(options) {
		const {sceneIds, tracks, activeTrackIds} = options;
		const uniqSceneIds = uniq(sceneIds);
		if (uniqSceneIds.length === 0) {
			throw (new Error('empty sceneIds'));
		}

		if (uniqSceneIds.length === 1) {
			return activeTrackIds.fill(uniqSceneIds);
		}

		const sceneIdsByActiveTrack = [];

		activeTrackIds.forEach(trackId => {
			const uniqSceneIds = uniq(sceneIds.filter((_, frameIndex) => tracks[trackId][frameIndex]));
			sceneIdsByActiveTrack.push(uniqSceneIds);
		});
		return sceneIdsByActiveTrack;
	}

	checkEachActiveTrackIsInOneScene({sceneIds, tracks, activeTrackIds}) {
		const sceneIdsByActiveTrack = this.getSceneIdsByActiveTrack({sceneIds, tracks, activeTrackIds});
		sceneIdsByActiveTrack.forEach((sceneIds, activeTrackIndex) => {
			if (sceneIds.length !== 1) {
				throw (new Error(`track ${activeTrackIds[activeTrackIndex]} should have one scene and has ${sceneIds}`));
			}
		});
	}

	splitActiveTrackIdsByScene(options) {
		const {tracks, activeTrackIds, sceneIds} = options;
		const uniqSceneIds = uniq(sceneIds);
		this.checkEachActiveTrackIsInOneScene(options);
		const activeTrackIdByScene = uniqSceneIds.map(sceneId => {
			return activeTrackIds
				.filter(trackId => tracks[trackId]
					.some((d, frameIndex) => d !== null && (sceneIds[frameIndex] === sceneId))
				);
		});
		return activeTrackIdByScene;
	}

	getActiveTrackIdByScene(options) {
		const {sceneIds, activeTrackIds} = options;

		const sceneIdsByActiveTrack = this.getSceneIdsByActiveTrack(options);
		const uniqSceneIds = uniq(sceneIds);

		const activeTrackIdByScene = uniqSceneIds.map(sceneId => {
			return sceneIdsByActiveTrack
				.map((values, activeTrackIndex) => ({values, activeTrackIndex}))
				.filter(v => v.values.includes(sceneId))
				.map(v => activeTrackIds[v.activeTrackIndex]);
		});
		return activeTrackIdByScene;
	}
}

module.exports = AbstractDistPostProcess;
