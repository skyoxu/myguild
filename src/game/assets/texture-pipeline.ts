/**
 * 轻量纹理/atlas 管线占位：不引入第三方工具，仅定义清单与加载顺序。
 */

export interface AtlasDef {
  key: string;
  image: string; // .png/.webp
  data: string; // .json (hash/array)
}

export interface TextureDef {
  key: string;
  url: string;
}

export interface TexturePipelineConfig {
  atlases?: AtlasDef[];
  textures?: TextureDef[];
}

/**
 * 在 Phaser.Scene 的 preload 中使用：
 *   setupTexturePipeline(this.load, config)
 */
export function setupTexturePipeline(loader: any, cfg: TexturePipelineConfig) {
  if (!loader || !cfg) return;
  if (cfg.atlases) {
    for (const a of cfg.atlases) {
      // loader.atlas(key, textureURL, atlasDataURL)
      loader.atlas?.(a.key, a.image, a.data);
    }
  }
  if (cfg.textures) {
    for (const t of cfg.textures) {
      loader.image?.(t.key, t.url);
    }
  }
}

/**
 * 示例清单：按需填充真实资源路径
 */
export const DEFAULT_TEXTURES: TexturePipelineConfig = {
  atlases: [
    // { key: 'ui', image: '/assets/ui/ui.webp', data: '/assets/ui/ui.json' },
  ],
  textures: [
    // { key: 'placeholder', url: '/assets/images/placeholder.webp' },
  ],
};
