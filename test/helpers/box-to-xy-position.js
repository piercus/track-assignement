const {matMul, subtract} = require('simple-linalg');

const undistortPoints = function ({points, camConf}) {
	if (!camConf.cameraMatrix) {
		// No distortion
		return points;
	}

	const [[fx, , cx], [, fy, cy]] = camConf.cameraMatrix;

	const undistort = function (point, distCoeffs) {
		const k = distCoeffs;

		for (let i = 0; i < 8; i++) {
			if (typeof (k[i]) !== 'number') {
				k[i] = 0;
			}
		}

		const iters = 5;
		// From https://github.com/egonSchiele/OpenCV/blob/master/modules/imgproc/src/undistort.cpp#L346
		// compensate distortion iteratively
		const [x0, y0] = point;
		let x = point[0];
		let y = point[1];

		for (let j = 0; j < iters; j++) {
			// Console.log('start', {x, x0, p0: point[0], j})
			const r2 = (x * x) + (y * y);
			const icdist = (1 + (((((k[7] * r2) + k[6]) * r2) + k[5]) * r2)) / (1 + (((((k[4] * r2) + k[1]) * r2) + k[0]) * r2));
			const deltaX = (2 * k[2] * x * y) + (k[3] * (r2 + (2 * x * x)));
			const deltaY = (k[2] * (r2 + (2 * y * y))) + (2 * k[3] * x * y);
			x = (x0 - deltaX) * icdist;
			y = (y0 - deltaY) * icdist;
			// Console.log('end', {x, x0, p0: point[0], j, deltaX, icdist})
		}

		return [x, y];
	};

	const undistortOnePoint = function (a) {
		const [u, v] = a;
		const [x2, y2] = [(u - cx) / fx, (v - cy) / fy];
		const [x, y] = undistort([x2, y2], camConf.distCoeffs);
		return [(x * fx) + cx, (y * fy) + cy];
	};

	return points.map(undistortOnePoint);
};

const perspectiveMatFromCamConf = function ({camConf, cv, cameraToPitch = true}) {
	if (cv) {
		const distCoeffs = new cv.Mat([camConf.distCoeffs], cv.CV_32F);
		const cameraMatrix = new cv.Mat(camConf.cameraMatrix, cv.CV_32F);
		const [imgWidth, imgHeight] = camConf.resolution;

		const {border} = camConf;
		const srcPoints = cv.undistortPoints(
			camConf.cameraCorners.map(([x, y]) => {
				return new cv.Point(Math.floor(x + (border * imgWidth)), Math.floor(y + (border * imgHeight)));
			}), cameraMatrix, distCoeffs);

		const destPoints = camConf.pitchCorners.map(([x, y]) => {
			return new cv.Point(x, y);
		});
		const result = cv.getPerspectiveTransform(
			cameraToPitch ? srcPoints : destPoints,
			cameraToPitch ? destPoints : srcPoints
		);
		// Console.log(`cv perspectiveMat ${result.getDataAsArray()}`);
		return result;
	}

	if (camConf.perspectiveMat) {
		return camConf.perspectiveMat;
	}

	throw (new Error('cv or camConf.perspectiveMat must be defined'));
};

const getPoint = function ({origin, camConf}) {
	const [x1, y1] = origin;
	const {border, resolution} = camConf;
	const [imgWidth, imgHeight] = resolution;
	const perspectiveMat = perspectiveMatFromCamConf({camConf});
	const [[x2, y2]] = undistortPoints({
		points: [
			[Math.floor(x1 + (border * imgWidth)), Math.floor(y1 + (border * imgHeight))]
		],
		camConf
	});
	const mat = matMul(perspectiveMat, [[x2], [y2], [1]]);
	return [
		mat[0][0] / mat[2][0],
		mat[1][0] / mat[2][0]
	];
};

module.exports = function ({box, camConf, time, pixelsStdErr}) {
	if (typeof (pixelsStdErr) === 'undefined' || typeof (pixelsStdErr[0]) !== 'number') {
		console.log({pixelsStdErr});
		throw (new TypeError('pixelsStdErr[0] is mandatory'));
	}

	const x1 = (box[0] + (box[2] / 2));
	const y1 = (box[1] + box[3]);
	const point = getPoint({origin: [x1, y1], camConf});
	const nearPoint = getPoint({origin: [x1 + pixelsStdErr[0], y1 + pixelsStdErr[1]], camConf});

	const stdErrorSub = subtract([point], [nearPoint]);
	const stdErr = [
		stdErrorSub[0][0],
		stdErrorSub[0][1]
	];
	const variance = [
		stdErr[0] * stdErr[0],
		stdErr[1] * stdErr[1]
	];
	const position = {
		values: [
			point[0],
			point[1]
		],
		variance,
		camIds: [camConf.camId],
		t: time
	};
	if (Number.isNaN(position.values[0])) {
		console.log({point, nearPoint, variance});
		throw (new TypeError('after lens correction, position is NaN'));
	}

	if (Number.isNaN(position.t)) {
		throw (new TypeError('after lens correction, position.t is NaN'));
	}

	if (Number.isNaN(position.variance[0])) {
		console.log({point, nearPoint});
		throw (new Error('after lens correction, position.variance[0] is NaN'));
	}

	return position;
};
