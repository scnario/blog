// src/lib/pb.ts
import PocketBase from 'pocketbase';

// 这里的地址是你已经穿透成功的公网数据库面板地址
const pb = new PocketBase('https://db.91917788.xyz');

// 在 SSR 模式下禁用自动取消请求
pb.autoCancellation(false);

export default pb;