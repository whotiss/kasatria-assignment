// From Three.js examples/js/renderers/CSS3DRenderer.js

THREE.CSS3DObject = function (element) {

    THREE.Object3D.call(this);

    this.element = element;
    this.element.style.position = 'absolute';

    this.addEventListener('removed', function () {

        if (this.element.parentNode !== null) {
            this.element.parentNode.removeChild(this.element);
        }

    });

};

THREE.CSS3DObject.prototype = Object.create(THREE.Object3D.prototype);
THREE.CSS3DObject.prototype.constructor = THREE.CSS3DObject;


THREE.CSS3DSprite = function (element) {

    THREE.CSS3DObject.call(this, element);

};

THREE.CSS3DSprite.prototype = Object.create(THREE.CSS3DObject.prototype);
THREE.CSS3DSprite.prototype.constructor = THREE.CSS3DSprite;


// Renderer

THREE.CSS3DRenderer = function () {

    console.log('THREE.CSS3DRenderer', THREE.REVISION);

    var _width, _height;
    var _widthHalf, _heightHalf;

    var matrix = new THREE.Matrix4();

    var cache = {
        camera: { fov: 0, style: '' },
        objects: new WeakMap()
    };

    var domElement = document.createElement('div');
    domElement.style.overflow = 'hidden';

    this.domElement = domElement;

    var cameraElement = document.createElement('div');
    cameraElement.style.transformStyle = 'preserve-3d';
    domElement.appendChild(cameraElement);

    this.getSize = function () {
        return {
            width: _width,
            height: _height
        };
    };

    this.setSize = function (width, height) {

        _width = width;
        _height = height;
        _widthHalf = _width / 2;
        _heightHalf = _height / 2;

        domElement.style.width = width + 'px';
        domElement.style.height = height + 'px';

        cameraElement.style.width = width + 'px';
        cameraElement.style.height = height + 'px';

    };

    function epsilon(value) {
        return Math.abs(value) < 1e-6 ? 0 : value;
    }

    function getCameraCSSMatrix(matrix) {

        var elements = matrix.elements;

        return 'matrix3d(' +
            epsilon(elements[0]) + ',' +
            epsilon(- elements[1]) + ',' +
            epsilon(elements[2]) + ',' +
            epsilon(elements[3]) + ',' +
            epsilon(elements[4]) + ',' +
            epsilon(- elements[5]) + ',' +
            epsilon(elements[6]) + ',' +
            epsilon(elements[7]) + ',' +
            epsilon(elements[8]) + ',' +
            epsilon(- elements[9]) + ',' +
            epsilon(elements[10]) + ',' +
            epsilon(elements[11]) + ',' +
            epsilon(elements[12]) + ',' +
            epsilon(- elements[13]) + ',' +
            epsilon(elements[14]) + ',' +
            epsilon(elements[15]) +
            ')';

    }

    function getObjectCSSMatrix(matrix, cameraCSSMatrix) {

        var elements = matrix.elements;
        var cssMatrix = 'matrix3d(' +
            epsilon(elements[0]) + ',' +
            epsilon(elements[1]) + ',' +
            epsilon(elements[2]) + ',' +
            epsilon(elements[3]) + ',' +
            epsilon(- elements[4]) + ',' +
            epsilon(- elements[5]) + ',' +
            epsilon(- elements[6]) + ',' +
            epsilon(- elements[7]) + ',' +
            epsilon(elements[8]) + ',' +
            epsilon(elements[9]) + ',' +
            epsilon(elements[10]) + ',' +
            epsilon(elements[11]) + ',' +
            epsilon(elements[12]) + ',' +
            epsilon(elements[13]) + ',' +
            epsilon(elements[14]) + ',' +
            epsilon(elements[15]) +
            ')';

        return 'translate(-50%,-50%)' + cssMatrix + cameraCSSMatrix;

    }

    this.render = function (scene, camera) {

        var fov = camera.projectionMatrix.elements[5] * _heightHalf;

        if (cache.camera.fov !== fov) {

            domElement.style.perspective = camera.projectionMatrix.elements[5] * _heightHalf + 'px';
            cache.camera.fov = fov;

        }

        scene.updateMatrixWorld();

        if (camera.parent === null) camera.updateMatrixWorld();

        var cameraCSSMatrix = 'translateZ(' + fov + 'px)' +
            getCameraCSSMatrix(camera.matrixWorldInverse);

        var style = cameraCSSMatrix;

        if (cache.camera.style !== style) {
            cameraElement.style.transform = style;
            cache.camera.style = style;
        }

        renderObject(scene, camera, cameraCSSMatrix);

    };

    function renderObject(object, camera, cameraCSSMatrix) {

        if (object instanceof THREE.CSS3DObject) {

            var style = getObjectCSSMatrix(object.matrixWorld, cameraCSSMatrix);
            var element = object.element;

            element.style.transform = style;

            if (element.parentNode !== cameraElement) {
                cameraElement.appendChild(element);
            }

        }

        for (var i = 0, l = object.children.length; i < l; i++) {

            renderObject(object.children[i], camera, cameraCSSMatrix);

        }

    }

};
