const {allNonNull} = require('object-tracking-measure');

const uniq = array => array.filter((a, index) => array.indexOf(a) === index);

const defaultGetIdFromDetection = (o, index) => [index];

module.exports = function ({exclusion = {getIdFromDetection: defaultGetIdFromDetection}}) {
	const getIdFromDetection = exclusion.getIdFromDetection;

	return {
		mapTrack: t => t,
		fn: (t1, t2) => {
			const ids1 = allNonNull({track: t1}).map(i => getIdFromDetection(t1[i], i)).reduce((a, b) => a.concat(b));
			const ids2 = allNonNull({track: t2}).map(i => getIdFromDetection(t2[i], i)).reduce((a, b) => a.concat(b));

			const l = uniq(ids1.filter(value => ids2.includes(value))).length;
			return l / Math.min(ids1.length, ids2.length);
		}
	};
};

