// =====================================================
// 内联 3D 预览（OBJ）—— 供嘉立创主窗口的“3D”预览窗格使用
// 立创在线 3D 预览的数据源是 OBJ（modules.lceda.cn/3dmodel/{uuid}），
// 与用于编辑的 STEP 是两套数据：OBJ 用于秒开预览，STEP 用于 Chili3d 编辑。
//
// 该文件用 esbuild 打包成 vendor/objviewer.js（IIFE，暴露 window.ObjViewer），
// 因为主窗口 CSP 为 script-src 'self'，需要本地打包脚本而非 importmap。
// =====================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLParser } from './objviewer.mtl.js';

// 从 OBJ 正文中剥离内联的 MTL 定义块（立创 OBJ 把材质直接写在文件里，
// 但没有 mtllib，直接喂给 OBJLoader 会刷一屏 "Unexpected line: newmtl"）。
function splitInlineMtl(text) {
    const MTL_KEYS = /^(newmtl|endmtl|Ka|Kd|Ks|Kt|Ns|Ni|d|Tr|illum|map_[A-Za-z]+|bump|disp|decal)\b/;
    const objLines = [];
    const mtlLines = [];
    for (const line of text.split(/\r?\n/)) {
        if (MTL_KEYS.test(line.trim())) {
            mtlLines.push(line);
        } else {
            objLines.push(line);
        }
    }
    return { objText: objLines.join('\n'), mtlText: mtlLines.length ? mtlLines.join('\n') : null };
}

class Viewer {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        // 背景由 CSS 渐变提供（贴合立创 3D 视图观感），WebGL 画布本身透明
        this.scene.background = null;

        this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100000);
        this.camera.position.set(20, -20, 20);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        this.renderer.setClearColor(0x000000, 0); // 透明清屏，露出 CSS 渐变背景
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);
        container.appendChild(this.renderer.domElement);

        // 双光源：保证金属/塑料面都能看清轮廓
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.1));
        const dir = new THREE.DirectionalLight(0xffffff, 0.9);
        dir.position.set(1, 2, 3);
        this.scene.add(dir);
        const dir2 = new THREE.DirectionalLight(0xffffff, 0.5);
        dir2.position.set(-2, -1, -2);
        this.scene.add(dir2);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;

        this.current = null;
        this._animate = this._animate.bind(this);
        this._animate();

        this._ro = new ResizeObserver(() => this.resize());
        this._ro.observe(container);
        this.resize();
    }

    _animate() {
        this._raf = requestAnimationFrame(this._animate);
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    resize() {
        const w = this.container.clientWidth || 1;
        const h = this.container.clientHeight || 1;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    clear() {
        if (this.current) {
            this.scene.remove(this.current);
            this.current.traverse((o) => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) {
                    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
                }
            });
            this.current = null;
        }
    }

    // 把一组材质强制设为不透明标准材质，保留 Kd 漫反射颜色。
    _normalizeMaterials(map) {
        const result = {};
        if (!map) return null;
        for (const name of Object.keys(map)) {
            const src = map[name];
            const color = src && src.color ? src.color.clone() : new THREE.Color(0xb0b0b0);
            result[name] = new THREE.MeshStandardMaterial({
                color,
                metalness: 0.15,
                roughness: 0.75,
                // 立创 OBJ 的 alpha(d) 常为 0，若沿用会导致整个模型透明不可见
                transparent: false,
                opacity: 1
            });
        }
        return result;
    }

    // text: 完整 OBJ 文本。返回统计信息用于日志
    loadObj(text) {
        this.clear();
        const { objText, mtlText } = splitInlineMtl(text);

        const loader = new OBJLoader();
        if (mtlText) {
            const materials = this._normalizeMaterials(MTLParser.parse(mtlText));
            if (materials) {
                // OBJLoader.setMaterials 需要一个带 create(name) 的库对象
                loader.setMaterials({
                    create: (name) => materials[name] || null,
                    get: (name) => materials[name] || null,
                    add: () => {}
                });
            }
        }

        const obj = loader.parse(objText);

        // 立创 OBJ 无 vertex normal，需补算，否则面发黑
        obj.traverse((o) => {
            if (!o.isMesh) return;
            if (o.geometry && !o.geometry.attributes.normal) {
                o.geometry.computeVertexNormals();
            }
            const empty = !o.material || (Array.isArray(o.material) && o.material.length === 0);
            const fullyTransparent = !Array.isArray(o.material) && o.material && o.material.transparent && o.material.opacity === 0;
            if (empty || fullyTransparent) {
                o.material = new THREE.MeshStandardMaterial({ color: 0xb0b0b0, metalness: 0.15, roughness: 0.75 });
            }
        });

        this.scene.add(obj);
        this.current = obj;
        this._fitToView(obj);

        const meshCount = obj.children.filter((c) => c.isMesh).length;
        let tris = 0;
        obj.traverse((o) => {
            if (o.isMesh && o.geometry && o.geometry.attributes.position) {
                // OBJLoader 输出非索引几何：三角形数 = 顶点数 / 3
                tris += o.geometry.attributes.position.count / 3;
            }
        });
        return { meshCount, tris };
    }

    _fitToView(obj) {
        const box = new THREE.Box3().setFromObject(obj);
        if (box.isEmpty()) return;
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const dist = (maxDim / (2 * Math.tan((this.camera.fov * Math.PI) / 360))) * 1.6;
        this.controls.target.copy(center);
        this.camera.position.set(center.x + dist, center.y - dist, center.z + dist * 0.8);
        this.camera.near = maxDim / 1000;
        this.camera.far = maxDim * 100;
        this.camera.updateProjectionMatrix();
        this.controls.update();
    }

    dispose() {
        cancelAnimationFrame(this._raf);
        if (this._ro) this._ro.disconnect();
        this.clear();
        this.controls.dispose();
        this.renderer.dispose();
        if (this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
    }
}

window.ObjViewer = {
    create: (container) => new Viewer(container)
};
