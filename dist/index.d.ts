declare class BilibiliDataSourcePlugin {
    readonly id = "compass-plugin-bilibili";
    readonly name = "Bilibili \u97F3\u4E50";
    private context?;
    private platform;
    private settings;
    private wbi;
    private buvid;
    activate(context: any): Promise<void>;
    deactivate(): Promise<void>;
    search(query: string, options?: any): Promise<any[]>;
    resolveStream(track: any): Promise<any>;
    getMetadata(track: any): Promise<any>;
    private initWbi;
    private initBuvid;
    private registerProtocols;
    private searchWithWbi;
    private searchLegacy;
    private getVideoInfo;
    private getAudioUrl;
    /** Get non-DASH audio URL (durl format) — returns .flv/.mp4 that AVPlayer can handle */
    private getAudioUrlDurl;
    private getAudioUrlWithWbi;
    private getAudioUrlLegacy;
    private extractBestAudio;
    private toSearchResult;
    private cleanHtml;
    private wrapImageUrl;
    private parseDuration;
}
declare const plugin: BilibiliDataSourcePlugin;

export { BilibiliDataSourcePlugin, plugin as default };
