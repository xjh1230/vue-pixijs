import TWEEN from "@tweenjs/tween.js";
import Bullet from "../Bullet.js";
import Plane from "../Plane.js";
import Map from "../Map.js";
import EnemyPlane from "../EnemyPlane";
import { game } from "../../../game";
import { hitTestRectangle } from "../../utils";
import {
  h,
  reactive,
  ref,
  watch,
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
} from "../../../../../src/index.js";
import { moveBullets } from "../../moveBullets";
import { moveEnemyPlane } from "../../moveEnemyPlane";
import { stage } from "../../config/index.js";
import { useKeyboardMove } from "../../use";
import { PAGE } from "./index";

let hashCode = 0;
const createHashCode = () => {
  return hashCode++;
};

const useSelfPlane = ({ x, y, speed }) => {
  const selfPlane = reactive({
    x,
    y,
    speed,
    width: 119,
    height: 181,
  });

  const { x: selfPlaneX, y: selfPlaneY } = useKeyboardMove({
    x: selfPlane.x,
    y: selfPlane.y,
    speed: selfPlane.speed,
  });

  // 缓动出场
  var tween = new TWEEN.Tween({
    x,
    y,
  })
    .to({ y: y - 200 }, 500)
    .start();
  tween.onUpdate((obj) => {
    selfPlane.x = obj.x;
    selfPlane.y = obj.y;
  });

  const handleTicker = () => {
    TWEEN.update();
  };

  onUnmounted(() => {
    game.ticker.remove(handleTicker);
  });

  onMounted(() => {
    game.ticker.add(handleTicker);
  });

  selfPlane.x = selfPlaneX;
  selfPlane.y = selfPlaneY;

  return selfPlane;
};

const useEnemyPlanes = () => {
  //生产敌机
  const createEnemyPlaneData = (x) => {
    return {
      x,
      y: -200,
      width: 217,
      height: 263,
      life: 3,
    };
  };

  const enemyPlanes = reactive([]);

  setInterval(() => {
    const x = Math.floor((1 + stage.width) * Math.random());
    enemyPlanes.push(createEnemyPlaneData(x));
  }, 1000);

  return enemyPlanes;
};

export default defineComponent({
  props: ["onNextPage"],
  setup(props) {
    const selfPlane = useSelfPlane({
      x: stage.width / 2 - 60,
      y: stage.height,
      speed: 7,
    });
    const selfBullets = reactive([]);
    const enemyPlanes = useEnemyPlanes();
    const enemyPlaneBullets = reactive([]);

    const handleBulletDestroy = ({ id }) => {
      const index = selfBullets.findIndex((info) => info.id == id);
      if (index !== -1) {
        selfBullets.splice(index, 1);
      }
    };

    const handlePlaneAttack = ({ x, y }) => {
      const id = createHashCode();
      const width = 26;
      const height = 37;
      const dir = -1;
      selfBullets.push({ x, y, id, width, height, dir });
    };

    const handleEnemyPlaneAttack = ({ x, y }) => {
      const id = createHashCode();
      const width = 26;
      const height = 37;
      const dir = 1;
      enemyPlaneBullets.push({ x, y, id, width, height, dir });
    };

    const handleTicker = () => {
      moveBullets(selfBullets);
      moveBullets(enemyPlaneBullets);
      moveEnemyPlane(enemyPlanes);

      // 先遍历自己所有的子弹
      selfBullets.forEach((bullet, selfIndex) => {
        // 检测我方子弹是否碰到了敌机
        enemyPlanes.forEach((enemyPlane, enemyPlaneIndex) => {
          const isIntersect = hitTestRectangle(bullet, enemyPlane);
          if (isIntersect) {
            selfBullets.splice(selfIndex, 1);

            // 敌机需要减血
            enemyPlane.life--;
            if (enemyPlane.life <= 0) {
              // todo
              // 可以让实例发消息过来在销毁
              // 因为需要在销毁之前播放销毁动画
              enemyPlanes.splice(enemyPlaneIndex, 1);
            }
          }
        });

        // 检测是否碰到了敌方子弹
        enemyPlaneBullets.forEach((enemyBullet, enemyBulletIndex) => {
          const isIntersect = hitTestRectangle(bullet, enemyBullet);
          if (isIntersect) {
            selfBullets.splice(selfIndex, 1);
            enemyPlaneBullets.splice(enemyBulletIndex, 1);
          }
        });
      });

      // 遍历敌军的子弹
      enemyPlaneBullets.forEach((enemyBullet, enemyBulletIndex) => {
        const isIntersect = hitTestRectangle(selfPlane, enemyBullet);
        if (isIntersect) {
          // 碰到我方飞机
          // 直接 game over
          // 跳转到结束页面
          props.onNextPage(PAGE.end);
        }
      });

      // 遍历敌军
      // 我方和敌军碰撞也会结束游戏
      enemyPlanes.forEach((enemyPlane) => {
        const isIntersect = hitTestRectangle(selfPlane, enemyPlane);
        if (isIntersect) {
          // 碰到我方飞机
          // 直接 game over
          // 跳转到结束页面
          props.onNextPage(PAGE.end);
        }
      });
    };

    onUnmounted(() => {
      game.ticker.remove(handleTicker);
    });

    onMounted(() => {
      game.ticker.add(handleTicker);
    });

    return {
      selfPlane,
      enemyPlanes,
      selfBullets,
      enemyPlaneBullets,
      handleBulletDestroy,
      handlePlaneAttack,
      handleEnemyPlaneAttack,
    };
  },

  render(ctx) {
    const createBullet = (info, index) => {
      return h(Bullet, {
        key: "Bullet" + info.id,
        x: info.x,
        y: info.y,
        id: info.id,
        width: info.width,
        height: info.height,
        onDestroy: ctx.handleBulletDestroy,
      });
    };

    const createEnemyPlane = (info, index) => {
      return h(EnemyPlane, {
        key: "EnemyPlane" + index,
        x: info.x,
        y: info.y,
        height: info.height,
        width: info.width,
        onAttack: ctx.handleEnemyPlaneAttack,
      });
    };

    return h("Container", [
      h(Map),
      h(Plane, {
        x: ctx.selfPlane.x,
        y: ctx.selfPlane.y,
        speed: ctx.selfPlane.speed,
        onAttack: ctx.handlePlaneAttack,
      }),
      ...ctx.selfBullets.map(createBullet),
      ...ctx.enemyPlaneBullets.map(createBullet),
      ...ctx.enemyPlanes.map(createEnemyPlane),
    ]);
  },
});
