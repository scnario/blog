// src/lib/pb.ts
import PocketBase from 'pocketbase';

const PB_URL = import.meta.env.PB_URL || 'https://db.91917788.xyz';

const pb = new PocketBase(PB_URL);

// 在 SSR 模式下禁用自动取消请求
pb.autoCancellation(false);

export default pb;
