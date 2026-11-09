import { startProtectedPage } from "./page-guard.js";

startProtectedPage(async () => {
    await import("./videos.js");
});