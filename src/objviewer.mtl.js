// 轻量 MTL 解析：只提取材质名与漫反射颜色（Kd，回退 Ka）。
// 不用 three 的 MTLLoader，是因为它会忠实解析 alpha(d)；
// 立创 OBJ 的 d 常为 0，会让预览整体透明。这里只取颜色，
// 由调用方决定是否透明（预览一律不透明）。
import * as THREE from 'three';

function parseVec(str) {
    return str.trim().split(/\s+/).map(Number).filter((n) => !Number.isNaN(n));
}

export const MTLParser = {
    /**
     * @param {string} mtlText 仅含材质定义的文本
     * @returns {Record<string, { color: THREE.Color }>|null}
     */
    parse(mtlText) {
        const result = {};
        let current = null;
        let kd = null;
        let ka = null;

        const flush = () => {
            if (!current) return;
            const v = kd || ka;
            const color = v && v.length >= 3
                ? new THREE.Color(
                    Math.min(1, Math.max(0, v[0])),
                    Math.min(1, Math.max(0, v[1])),
                    Math.min(1, Math.max(0, v[2]))
                )
                : new THREE.Color(0xb0b0b0);
            result[current] = { color };
            kd = null;
            ka = null;
        };

        for (const raw of mtlText.split(/\r?\n/)) {
            const line = raw.trim();
            if (!line) continue;
            if (line.startsWith('newmtl')) {
                flush();
                current = line.slice('newmtl'.length).trim();
            } else if (line.startsWith('Kd')) {
                kd = parseVec(line.slice(2));
            } else if (line.startsWith('Ka')) {
                ka = parseVec(line.slice(2));
            }
        }
        flush();
        return Object.keys(result).length ? result : null;
    }
};
