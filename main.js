import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
//加载所有antd组件，实际使用时，应该仅加载使用部分
import Antd from "ant-design-vue";
import "ant-design-vue/dist/reset.css";
//const app = createApp(App);
//app.use(Antd);
createApp(App).use(store).use(Antd).use(router).mount("#app");
