// 使用 LocalStorage 作為數據存儲
// 全域錯誤防禦與儀表板
window.onerror = function (msg, url, line, col, error) {
    const debug = document.getElementById('debugInfo');
    if (debug) {
        debug.style.display = 'block';
        debug.innerHTML += `<div>❌ 錯誤: ${msg} (${line}:${col})</div>`;
    }
    console.error("Critical Error:", msg, error);
    return false;
};

// Three.js 3D 場景
let scene, camera, renderer, controls;
let petObjects = [];
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let grabbedPet = null;
let dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // 地面平面 用於計算拖拽位置
let sun;
let clouds = [];
let girl; // 走路的小女生
let farmEnclosures = []; // 存儲閉合圍籬的範圍
let smokeParticles = []; // 帳篷冒煙粒子
let butterflies = []; // 儲存蝴蝶物件
let rainbow; // 彩虹物件

// DOM 元素
const diaryContent = document.getElementById('diaryContent');
const saveDiaryBtn = document.getElementById('saveDiaryBtn');
const noteInput = document.getElementById('noteInput');
const addNoteBtn = document.getElementById('addNoteBtn');
const notesList = document.getElementById('notesList');
const petContainer = document.getElementById('petContainer');
const dogCount = document.getElementById('dogCount');
const catCount = document.getElementById('catCount');
const totalDiariesEl = document.getElementById('totalDiaries');
const totalNotes = document.getElementById('totalNotes');
const diaryHistory = document.getElementById('diaryHistory');
const warningText = document.getElementById('warningText');

// 寵物類型與品種
const PET_BREEDS = {
    dog: ['shiba', 'corgi'],
    cat: ['munchkin']
};
const PET_EMOJI = { dog: '🐶', cat: '🐱', shiba: '🐕', corgi: '🦊', munchkin: '🐈' };
const BREED_NAMES = {
    shiba: '柴犬',
    corgi: '柯基',
    munchkin: '短腿貓'
};

// 應用狀態
let pets = [];
let notes = [];
let diaries = [];
let stats = {
    dogs: 0,
    cats: 0,
    totalDiaries: 0,
    lastEntryDate: null
};

// --- 地圖分區判定 (格局擴張版) ---
function isPositionOnWater(x, z) {
    const dist = Math.sqrt(x * x + z * z);
    return dist > 400; // 超出島嶼半徑即為海洋
}

// 初始化 Three.js 3D 場景
function initThreeJS() {
    const container = petContainer;
    if (!container) {
        console.error("找不到 petContainer 元素！");
        return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 防禦性檢查：如果容器還沒有尺寸，可能佈局尚未完成，嘗試延遲初始化
    if (width === 0 || height === 0) {
        console.warn("偵測到容器尺寸為 0，將於 100ms 後重試初始化...");
        setTimeout(initThreeJS, 100);
        return;
    }

    scene = new THREE.Scene();

    // 相機
    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
    camera.position.set(150, 200, 250);

    // 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.id = 'threeCanvas';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // OrbitControls - 3D 滑鼠拖拽
    if (typeof THREE.OrbitControls !== 'undefined') {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxPolarAngle = Math.PI / 2.1;
        controls.maxDistance = 600; // 限制最大縮放距離
        controls.minDistance = 100; // 限制最小縮放距離
    }

    // 地面 - 中央島嶼 (草地 - 擴張版)
    const groundGeom = new THREE.CircleGeometry(400, 64);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x90EE90 });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);


    // 光源
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 200, 100);
    scene.add(directionalLight);

    // 唯一的閉合型小圍籬
    createClosedEnclosure(100, 100, 60);

    // 裝飾場景：小樹 (適度精簡)
    for (let i = 0; i < 45; i++) {
        createTree();
    }

    // 太陽
    createSun();

    // 雲朵
    for (let i = 0; i < 12; i++) {
        createCloud();
    }

    // 帳篷
    createTent();

    // 更多的裝飾圍欄 (散落在場景各處，確保在島內)
    for (let i = 0; i < 5; i++) {
        createFence(-250 + i * 35, -250, 0);
        createFence(250, -280 + i * 35, Math.PI / 2);
        createFence(-320, 150 + i * 35, Math.PI / 2);
    }

    // 花叢 (分組生成 + 嚴格限制在島嶼內)
    const numClusters = 6;
    const flowersPerCluster = 10;
    for (let c = 0; c < numClusters; c++) {
        let centerX, centerZ;
        let attempts = 0;
        do {
            const r = Math.random() * 320; // 擴張生成範圍
            const theta = Math.random() * Math.PI * 2;
            centerX = Math.cos(theta) * r;
            centerZ = Math.sin(theta) * r;
            attempts++;
        } while (isInEnclosure(centerX, centerZ, 50) && attempts < 20);

        for (let i = 0; i < flowersPerCluster; i++) {
            const fx = centerX + (Math.random() - 0.5) * 60;
            const fz = centerZ + (Math.random() - 0.5) * 60;

            const dist = Math.sqrt(fx * fx + fz * fz);
            if (!isInEnclosure(fx, fz, 5) && dist < 380) { // 限制在 380 以內
                createFlowerPatch(fx, fz);
                if (Math.random() < 0.3) {
                    createButterfly(fx, 15, fz);
                }
            }
        }
    }



    // 建立小女生
    const girlModel = createGirlModel();
    const girlHint = createHintSprite();
    girlModel.group.add(girlHint);
    girl = {
        mesh: girlModel.group,
        legs: girlModel.legs,
        hint: girlHint,
        walking: true,
        angle: 0,
        speed: 0.5
    };
    scene.add(girl.mesh);
    girl.mesh.position.set(-50, 0, 50);

    // 小河流
    createRiver();

    // 動畫循環
    function animate() {
        requestAnimationFrame(animate);
        const time = Date.now() * 0.005;

        if (controls) controls.update();

        petObjects.forEach(petObj => {
            if (petObj.walking) {
                // 移動 (XZ 平面)
                let nextX = petObj.mesh.position.x + petObj.velocityX;
                let nextZ = petObj.mesh.position.z + petObj.velocityZ;

                // 邊界檢查 (島嶼圓形邊界 dist < 290)
                if (isPositionOnWater(nextX, nextZ)) {
                    petObj.velocityX *= -1;
                    petObj.velocityZ *= -1;
                    nextX = petObj.mesh.position.x;
                    nextZ = petObj.mesh.position.z;
                    updatePetRotation(petObj);
                }

                // 檢查是否撞到閉合圍籬
                const nextInEnclosure = isInEnclosure(nextX, nextZ, 5);
                const currentInEnclosure = isInEnclosure(petObj.mesh.position.x, petObj.mesh.position.z, 5);
                if (nextInEnclosure !== currentInEnclosure) {
                    petObj.velocityX *= -1;
                    petObj.velocityZ *= -1;
                    nextX = petObj.mesh.position.x;
                    nextZ = petObj.mesh.position.z;
                    updatePetRotation(petObj);
                }

                petObj.mesh.position.x = nextX;
                petObj.mesh.position.z = nextZ;

                // 隨機轉向
                if (Math.random() < 0.01) {
                    petObj.velocityX = (Math.random() - 0.5) * 1.0;
                    petObj.velocityZ = (Math.random() - 0.5) * 1.0;
                    updatePetRotation(petObj);
                }

                // 彈跳動畫
                const walkSpeed = 6;
                const bounce = Math.abs(Math.sin(time * walkSpeed)) * 5;
                petObj.mesh.position.y = bounce;

                // 腳跟著動
                if (petObj.legs) {
                    petObj.legs.forEach((leg, i) => {
                        const offset = (i === 0 || i === 3) ? 1 : -1;
                        leg.rotation.x = Math.sin(time * walkSpeed) * 0.6 * offset;
                    });
                }

                // 尾巴搖擺
                if (petObj.tail) {
                    petObj.tail.rotation.y = Math.sin(time * 12) * 0.8;
                }

                // 舌頭伸縮
                if (petObj.tongue) {
                    petObj.tongue.scale.z = 0.5 + Math.abs(Math.sin(time * 15)) * 1.5;
                }

                // 呼吸縮放
                const s = 1 + Math.sin(time * 3) * 0.03;
                petObj.mesh.scale.set(s, s, s);
            }
        });

        // 小女生行走動畫
        if (girl && girl.walking) {
            let nextX = girl.mesh.position.x + Math.cos(girl.angle) * girl.speed;
            let nextZ = girl.mesh.position.z + Math.sin(girl.angle) * girl.speed;

            // 邊界與圍籬檢查
            const nextInEnclosure = isInEnclosure(nextX, nextZ, 5);
            const currentInEnclosure = isInEnclosure(girl.mesh.position.x, girl.mesh.position.z, 5);

            if (isPositionOnWater(nextX, nextZ) || nextInEnclosure !== currentInEnclosure) {
                // 撞牆或落水，轉向
                girl.angle += Math.PI * (0.8 + Math.random() * 0.4);
            } else {
                girl.mesh.position.x = nextX;
                girl.mesh.position.z = nextZ;
            }

            girl.mesh.rotation.y = -girl.angle + Math.PI / 2;

            const walkSpeed = 8;
            const bounce = Math.abs(Math.sin(time * walkSpeed)) * 5;
            girl.mesh.position.y = bounce;

            if (girl.legs) {
                girl.legs.forEach((leg, i) => {
                    const offset = (i === 0) ? 1 : -1;
                    leg.rotation.x = Math.sin(time * walkSpeed) * 0.5 * offset;
                });
            }

            if (Math.random() < 0.01) {
                girl.angle += (Math.random() - 0.5) * 2;
            }
        }

        // 寵物提示動畫 (當被懸停時)
        petObjects.forEach(petObj => {
            if (petObj.isHovered) {
                petObj.mesh.scale.set(1.05, 1.05, 1.05); // 稍微放大但不抖動
                if (petObj.hint) {
                    petObj.hint.visible = true;
                    petObj.hint.position.y = 25; // 固定高度
                }
            } else {
                if (petObj.hint) petObj.hint.visible = false;
                if (!petObj.walking && grabbedPet !== petObj) {
                    petObj.mesh.scale.set(1, 1, 1);
                }
            }
        });

        // 小女生提示動畫
        if (girl) {
            if (girl.isHovered) {
                girl.mesh.scale.set(1.05, 1.05, 1.05); // 稍微放大但不抖動
                if (girl.hint) {
                    girl.hint.visible = true;
                    girl.hint.position.y = 30; // 固定高度
                }
            } else {
                if (girl.hint) girl.hint.visible = false;
                if (!girl.walking && grabbedPet !== girl) {
                    girl.mesh.scale.set(1, 1, 1);
                }
            }
        }

        // 太陽動畫 (微弱脈動)
        if (sun) {
            const sunScale = 1 + Math.sin(time * 2) * 0.05;
            sun.scale.set(sunScale, sunScale, sunScale);
        }

        // 雲朵動畫 (飄動)
        clouds.forEach(cloud => {
            cloud.position.x += cloud.userData.speed;
            if (cloud.position.x > 800) cloud.position.x = -800;
        });

        // 帳篷冒煙動畫 (加強濃厚版 - 適配大帳篷)
        smokeParticles.forEach(p => {
            p.position.y += 0.4 + Math.random() * 0.3; // 上升速度
            const driftSpeed = p.userData.driftSpeed || 0.2;
            p.position.x += Math.sin(time + p.userData.offset) * driftSpeed;
            p.position.z += Math.cos(time + p.userData.offset) * 0.2;
            p.scale.multiplyScalar(0.99); // 逐漸變小
            p.material.opacity *= 0.99; // 逐漸透明

            if (p.material.opacity < 0.05) {
                // 回到縮小後的帳篷頂部 (高度約 80-90)
                p.position.x = -80 + (Math.random() - 0.5) * 12;
                p.position.z = -50 + (Math.random() - 0.5) * 12;
                p.position.y = 80 + Math.random() * 10;
                p.scale.set(1.5 + Math.random(), 1.5 + Math.random(), 1.5 + Math.random());
                p.material.opacity = 0.5 + Math.random() * 0.3;
            }
        });

        // 蝴蝶動畫
        butterflies.forEach(b => {
            // 拍打翅膀
            b.wingL.rotation.y = Math.sin(time * 20) * 0.8 + 0.5;
            b.wingR.rotation.y = -Math.sin(time * 20) * 0.8 - 0.5;

            // 隨機飛舞路徑
            b.group.position.y += Math.sin(time * 2 + b.offset) * 0.1;
            b.group.position.x += Math.cos(time * 0.5 + b.offset) * 0.2;
            b.group.position.z += Math.sin(time * 0.5 + b.offset) * 0.2;
            b.group.rotation.y += 0.01;
        });


        renderer.render(scene, camera);
    }

    // 互動事件：滑鼠/觸控按下 (抓取)
    renderer.domElement.addEventListener('pointerdown', (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        const meshes = [...petObjects.map(p => p.mesh)];
        if (girl) meshes.push(girl.mesh);

        const intersects = raycaster.intersectObjects(meshes, true);

        if (intersects.length > 0) {
            let object = intersects[0].object;
            while (object.parent &&
                !petObjects.find(p => p.mesh === object) &&
                !(girl && girl.mesh === object)) {
                object = object.parent;
            }

            grabbedPet = petObjects.find(p => p.mesh === object);
            if (!grabbedPet && girl && girl.mesh === object) {
                grabbedPet = girl;
            }

            if (grabbedPet) {
                grabbedPet.walking = false;
                if (controls) controls.enabled = false;
                document.body.style.cursor = 'grabbing';
            }
        }
    });

    window.addEventListener('pointermove', (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        if (!grabbedPet) {
            raycaster.setFromCamera({ x: mx, y: my }, camera);
            const meshes = [...petObjects.map(p => p.mesh)];
            if (girl) meshes.push(girl.mesh);
            const intersects = raycaster.intersectObjects(meshes, true);

            petObjects.forEach(p => p.isHovered = false);
            if (girl) girl.isHovered = false;

            if (intersects.length > 0) {
                let object = intersects[0].object;
                while (object.parent &&
                    !petObjects.find(p => p.mesh === object) &&
                    !(girl && girl.mesh === object)) {
                    object = object.parent;
                }

                const hoveredPet = petObjects.find(p => p.mesh === object);
                if (hoveredPet) {
                    hoveredPet.isHovered = true;
                } else if (girl && girl.mesh === object) {
                    girl.isHovered = true;
                }
                renderer.domElement.style.cursor = 'grab';
            } else {
                renderer.domElement.style.cursor = 'default';
            }
        } else {
            mouse.x = mx;
            mouse.y = my;
            raycaster.setFromCamera(mouse, camera);

            let groundIntersects = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(dragPlane, groundIntersects)) {
                grabbedPet.mesh.position.x = groundIntersects.x;
                grabbedPet.mesh.position.z = groundIntersects.z;
                grabbedPet.mesh.position.y = 20;
            }
        }
    });

    window.addEventListener('pointerup', () => {
        if (grabbedPet) {
            grabbedPet.walking = true;
            grabbedPet.mesh.position.y = 0;
            grabbedPet = null;
            if (controls) controls.enabled = true;
            document.body.style.cursor = 'default';
        }
    });

    animate();

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

// 寵物模型設計 - 詳細品種版
function createPetModel(breed) {
    const group = new THREE.Group();
    const legs = [];
    let tail = null;
    let tongue = null;

    const whiteMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const orangeMat = new THREE.MeshPhongMaterial({ color: 0xFFA500 }); // 橘色/赤色
    const shibaMat = new THREE.MeshPhongMaterial({ color: 0xD2691E }); // 柴犬赤色
    const pinkMat = new THREE.MeshBasicMaterial({ color: 0xFF69B4 });
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    if (breed === 'shiba') {
        // --- 柴犬 ---
        // 身體
        const body = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 16), shibaMat);
        body.scale.set(1.2, 0.9, 0.9);
        body.position.y = 10;
        group.add(body);

        // 裏白 (白色肚皮)
        const belly = new THREE.Mesh(new THREE.SphereGeometry(6.5, 32, 16), whiteMat);
        belly.scale.set(1.1, 0.5, 0.8);
        belly.position.y = 7;
        group.add(belly);

        // 頭
        const head = new THREE.Mesh(new THREE.SphereGeometry(5.5, 32, 16), shibaMat);
        head.position.set(8, 14, 0);
        group.add(head);

        // 裏白 (臉部白色)
        const snout = new THREE.Mesh(new THREE.SphereGeometry(3.5, 32, 16), whiteMat);
        snout.scale.set(1.1, 0.8, 1);
        snout.position.set(10, 13, 0);
        group.add(snout);

        // 眼睛
        const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), blackMat);
        eye1.position.set(12, 15, 2);
        group.add(eye1);
        const eye2 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), blackMat);
        eye2.position.set(12, 15, -2);
        group.add(eye2);

        // 鼻子
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16), blackMat);
        nose.position.set(13.5, 14, 0);
        group.add(nose);

        // 尖耳朵
        const ear1 = new THREE.Mesh(new THREE.ConeGeometry(2, 4, 4), shibaMat);
        ear1.position.set(8, 19, 2.5);
        group.add(ear1);
        const ear2 = new THREE.Mesh(new THREE.ConeGeometry(2, 4, 4), shibaMat);
        ear2.position.set(8, 19, -2.5);
        group.add(ear2);

        // 捲捲尾巴 (柴犬特色)
        tail = new THREE.Group();
        const tailMesh = new THREE.Mesh(new THREE.TorusGeometry(3, 1.5, 16, 32, Math.PI * 1.5), shibaMat);
        tailMesh.rotation.y = Math.PI / 2;
        tail.add(tailMesh);
        tail.position.set(-8, 14, 0);
        group.add(tail);

        // 腿
        const legGeom = new THREE.CylinderGeometry(1.2, 1, 8, 16);
        const legPos = [{ x: 5, z: 4 }, { x: 5, z: -4 }, { x: -5, z: 4 }, { x: -5, z: -4 }];
        legPos.forEach(p => {
            const leg = new THREE.Mesh(legGeom, whiteMat);
            leg.position.set(p.x, 4, p.z);
            group.add(leg);
            legs.push(leg);
        });

    } else if (breed === 'corgi') {
        // --- 柯基 ---
        // 長身體
        const body = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 16), orangeMat);
        body.scale.set(1.5, 0.8, 0.8);
        body.position.y = 8;
        group.add(body);

        // 白色圍巾/肚皮
        const neck = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 16), whiteMat);
        neck.scale.set(0.6, 0.9, 0.9);
        neck.position.set(5, 8, 0);
        group.add(neck);

        // 頭
        const head = new THREE.Mesh(new THREE.SphereGeometry(5.5, 32, 16), orangeMat);
        head.position.set(10, 12, 0);
        group.add(head);

        // 白色面帶
        const muzzle = new THREE.Mesh(new THREE.SphereGeometry(3, 32, 16), whiteMat);
        muzzle.position.set(12.5, 11, 0);
        group.add(muzzle);

        // 眼睛
        const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), blackMat);
        eye1.position.set(14, 13, 2);
        group.add(eye1);
        const eye2 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), blackMat);
        eye2.position.set(14, 13, -2);
        group.add(eye2);

        // 大耳朵
        const ear1 = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 4), orangeMat);
        ear1.position.set(10, 16, 3.5);
        ear1.rotation.z = -0.2;
        group.add(ear1);
        const ear2 = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 4), orangeMat);
        ear2.position.set(10, 16, -3.5);
        ear2.rotation.z = -0.2;
        group.add(ear2);

        // 舌頭
        tongue = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 3), pinkMat);
        tongue.position.set(14, 10, 0);
        group.add(tongue);

        // 短短白腿
        const legGeom = new THREE.CylinderGeometry(1.5, 1.2, 5, 16);
        const legPos = [{ x: 6, z: 4 }, { x: 6, z: -4 }, { x: -7, z: 4 }, { x: -7, z: -4 }];
        legPos.forEach(p => {
            const leg = new THREE.Mesh(legGeom, whiteMat);
            leg.position.set(p.x, 2.5, p.z);
            group.add(leg);
            legs.push(leg);
        });

        // 屁股 (柯基特有的圓屁股)
        const butt = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 16), orangeMat);
        butt.position.set(-8, 8, 0);
        group.add(butt);

    } else if (breed === 'munchkin') {
        // --- 短腿貓 ---
        // 身體 (修長一些)
        const body = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 16), orangeMat);
        body.scale.set(1.3, 0.8, 0.8);
        body.position.y = 8;
        group.add(body);

        // 頭
        const head = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 16), orangeMat);
        head.position.set(7, 12, 0);
        group.add(head);

        // 貓耳
        const ear1 = new THREE.Mesh(new THREE.ConeGeometry(1.5, 4, 4), orangeMat);
        ear1.position.set(7, 16, 2.5);
        group.add(ear1);
        const ear2 = new THREE.Mesh(earGeom = new THREE.ConeGeometry(1.5, 4, 4), orangeMat);
        ear2.position.set(7, 16, -2.5);
        group.add(ear2);

        // 眼睛
        const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), blackMat);
        eye1.position.set(11, 13, 2);
        group.add(eye1);
        const eye2 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), blackMat);
        eye2.position.set(11, 13, -2);
        group.add(eye2);

        // 極短腿 (短腿貓特色)
        const legGeom = new THREE.CylinderGeometry(1, 1, 4, 16);
        const legPos = [{ x: 4, z: 3 }, { x: 4, z: -3 }, { x: -4, z: 3 }, { x: -4, z: -3 }];
        legPos.forEach(p => {
            const leg = new THREE.Mesh(legGeom, orangeMat);
            leg.position.set(p.x, 2, p.z);
            group.add(leg);
            legs.push(leg);
        });

        // 長尾巴
        tail = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.5, 15, 8), orangeMat);
        tail.position.set(-8, 12, 0);
        tail.rotation.z = -0.5;
        group.add(tail);
    }

    return { group, legs, tail, tongue };
}

// 修改後的更新朝向
function updatePetRotation(petObj) {
    const angle = Math.atan2(-petObj.velocityZ, petObj.velocityX);
    petObj.mesh.rotation.y = angle;
}

// 檢查座標是否在圍欄內
function isInEnclosure(x, z, padding = 0) {
    for (let enc of farmEnclosures) {
        if (x >= enc.xMin - padding && x <= enc.xMax + padding &&
            z >= enc.zMin - padding && z <= enc.zMax + padding) {
            return true;
        }
    }
    return false;
}

// 建立樹 (多樣化版：5 種不同類型)
function createTree() {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const greenColors = [0x2d5a27, 0x3e8e41, 0x2E8B57, 0x8bc34a, 0x1b5e20];
    const leavesMat = new THREE.MeshLambertMaterial({ color: greenColors[Math.floor(Math.random() * greenColors.length)] });

    // 樹幹
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.5, 12, 8), trunkMat);
    trunk.position.y = 6;
    group.add(trunk);

    const type = Math.floor(Math.random() * 3);

    switch (type) {
        case 0: // 圓錐松樹
            for (let i = 0; i < 3; i++) {
                const leaves = new THREE.Mesh(new THREE.ConeGeometry(10 - i * 2, 12, 8), leavesMat);
                leaves.position.y = 12 + i * 6;
                group.add(leaves);
            }
            break;
        case 1: // 大圓球
            const sphereLeaves = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 16), leavesMat);
            sphereLeaves.position.y = 18;
            group.add(sphereLeaves);
            break;
        case 2: // 雙層圓球
            const botSphere = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 16), leavesMat);
            botSphere.position.y = 15;
            group.add(botSphere);
            const topSphere = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 16), leavesMat);
            topSphere.position.y = 22;
            group.add(topSphere);
            break;
    }

    let x, z;
    let r, theta;
    let attempts = 0;
    do {
        r = 50 + Math.random() * 330; // 擴張生成範圍 (半徑 400)
        theta = Math.random() * Math.PI * 2;
        x = Math.cos(theta) * r;
        z = Math.sin(theta) * r;
        attempts++;
    } while ((isInEnclosure(x, z, 10) || isPositionOnWater(x, z)) && attempts < 20);

    group.position.set(x, 0, z);

    // 增加隨機高度 (有高有矮)
    const scale = 0.7 + Math.random() * 1.5; // 0.7x ~ 2.2x
    group.scale.set(scale, scale, scale);

    scene.add(group);
}

// 建立太陽 (放大 3 倍版)
function createSun() {
    const sunGeom = new THREE.SphereGeometry(120, 32, 32); // 40 * 3
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xFFEF00 }); // 發亮黃色
    sun = new THREE.Mesh(sunGeom, sunMat);
    sun.position.set(-100, 200, -800); // 稍微移遠並調高，配合大體積
    scene.add(sun);

    // 太陽光輝 (外圈 放大 3 倍)
    const glowGeom = new THREE.SphereGeometry(180, 32, 32); // 60 * 3
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.25 });
    const glow = new THREE.Mesh(glowGeom, glowMat);
    sun.add(glow);
}

// 建立雲朵
function createCloud() {
    const group = new THREE.Group();
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });

    // 雲是由多個球組成的
    const numSpheres = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numSpheres; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(15 + Math.random() * 10, 16, 16), cloudMat);
        s.position.set(i * 15 - 20, Math.random() * 10, Math.random() * 10);
        group.add(s);
    }

    // 隨機位置
    const x = Math.random() * 1600 - 800;
    const y = 80 + Math.random() * 80; // 再次降低高度
    const z = Math.random() * 1000 - 500;
    group.position.set(x, y, z);

    // 儲存速度
    group.userData = { speed: 0.1 + Math.random() * 0.3 };

    scene.add(group);
    clouds.push(group);
}

// 建立帳篷 (縮小後的版本)
function createTent() {
    const group = new THREE.Group();

    // 帳篷主體 (比原始稍大一點，縮小至目前的 30%)
    const geom = new THREE.ConeGeometry(60, 90, 4);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const tent = new THREE.Mesh(geom, mat);
    tent.position.y = 45;
    tent.rotation.y = Math.PI / 4;
    group.add(tent);

    // 條紋裝飾
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0x3498db });
    for (let i = 0; i < 4; i++) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(8, 91, 61), stripeMat);
        stripe.position.y = 45;
        stripe.rotation.y = (Math.PI / 2) * i + Math.PI / 4;
        group.add(stripe);
    }

    group.position.set(-80, 0, -50);
    scene.add(group);

    // 初始化冒煙粒子 (適配縮小後的帳篷)
    const smokeMat = new THREE.MeshLambertMaterial({ color: 0x999999, transparent: true, opacity: 0.6 });
    for (let i = 0; i < 40; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 3, 8, 8), smokeMat.clone());
        p.position.set(-80 + (Math.random() - 0.5) * 15, 80 + Math.random() * 40, -50 + (Math.random() - 0.5) * 15);
        p.userData.offset = Math.random() * 10;
        p.userData.driftSpeed = 0.1 + Math.random() * 0.3;
        scene.add(p);
        smokeParticles.push(p);
    }
}

// 建立圍欄
function createFence(x, z, rot) {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });

    // 兩個立柱
    const post1 = new THREE.Mesh(new THREE.BoxGeometry(4, 15, 4), woodMat);
    post1.position.set(-15, 7.5, 0);
    group.add(post1);

    const post2 = new THREE.Mesh(new THREE.BoxGeometry(4, 15, 4), woodMat);
    post2.position.set(15, 7.5, 0);
    group.add(post2);

    // 橫木
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(34, 3, 2), woodMat);
    rail1.position.set(0, 5, 0);
    group.add(rail1);

    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(34, 3, 2), woodMat);
    rail2.position.set(0, 11, 0);
    group.add(rail2);

    group.position.set(x, 0, z);
    group.rotation.y = rot;
    scene.add(group);
}

// 建立花叢
function createFlowerPatch(x, z) {
    const group = new THREE.Group();
    const colors = [0xff6b6b, 0xffd93d, 0xff8e9e];

    for (let i = 0; i < 5; i++) {
        const flower = new THREE.Group();
        // 莖
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 5), new THREE.MeshLambertMaterial({ color: 0x27ae60 }));
        stem.position.y = 2.5;
        flower.add(stem);

        // 花頭
        const head = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), new THREE.MeshLambertMaterial({ color: colors[Math.floor(Math.random() * colors.length)] }));
        head.position.y = 5;
        flower.add(head);

        flower.position.set((Math.random() - 0.5) * 20, 0, (Math.random() - 0.5) * 20);
        group.add(flower);
    }

    group.position.set(x, 0, z);
    scene.add(group);
}

// 建立天空彩虹
function createRainbow() {
    const group = new THREE.Group();
    const colors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3];
    const radius = 800;
    const tubeRadius = 10;

    colors.forEach((color, i) => {
        const geom = new THREE.TorusGeometry(radius - i * tubeRadius, tubeRadius, 16, 100, Math.PI);
        const mat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        const arch = new THREE.Mesh(geom, mat);
        group.add(arch);
    });

    group.position.set(200, -100, -800);
    group.rotation.y = -Math.PI / 6;
    scene.add(group);
    rainbow = group;
}

// 建立飛舞的小蝴蝶
function createButterfly(x, y, z) {
    const group = new THREE.Group();

    // 隨機顏色
    const colors = [0xFFC0CB, 0xFF69B4, 0x00FFFF, 0xFFFF00, 0x9370DB];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const wingMat = new THREE.MeshPhongMaterial({ color: color, side: THREE.DoubleSide });
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x333333 });

    // 身體
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2), bodyMat);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    // 翅膀
    const wingGeom = new THREE.PlaneGeometry(1.5, 2);

    const wingL = new THREE.Mesh(wingGeom, wingMat);
    wingL.position.x = 0.75;
    const wingLGroup = new THREE.Group();
    wingLGroup.add(wingL);
    group.add(wingLGroup);

    const wingR = new THREE.Mesh(wingGeom, wingMat);
    wingR.position.x = -0.75;
    const wingRGroup = new THREE.Group();
    wingRGroup.add(wingR);
    group.add(wingRGroup);

    group.position.set(x, y, z);
    scene.add(group);

    butterflies.push({
        group: group,
        wingL: wingLGroup,
        wingR: wingRGroup,
        offset: Math.random() * Math.PI * 2
    });
}

// 海洋已清除

// 建立河流 (縮短至島嶼內，避免伸入海面)
function createRiver() {
    const points = [];
    // 縮短範圍使其待在島內 (-250 到 250)
    for (let i = 0; i < 20; i++) {
        const x = -250 + i * 26.3; // 250 - (-250) = 500, 500/19 approx 26.3
        const z = Math.sin(i * 0.5) * 40;
        points.push(new THREE.Vector2(x, z));
    }

    // 將點轉化為形狀
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].y - 15);
    for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i].x, points[i].y - 15);
    }
    for (let i = points.length - 1; i >= 0; i--) {
        shape.lineTo(points[i].x, points[i].y + 15);
    }
    shape.closePath();

    const geom = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshLambertMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.5 });
    const river = new THREE.Mesh(geom, mat);
    river.rotation.x = -Math.PI / 2;
    river.position.y = 0.5; // 略高於地面
    scene.add(river);
}

// 建立小女生模型
function createGirlModel() {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshPhongMaterial({ color: 0xffdbac });
    const hairMat = new THREE.MeshPhongMaterial({ color: 0x3d2314 });
    const dressMat = new THREE.MeshPhongMaterial({ color: 0xffadc7 }); // 更可愛的粉色
    const socksMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const shoesMat = new THREE.MeshPhongMaterial({ color: 0x825a2c });

    // 身體 (洋裝 - 稍微豐滿一點)
    const dress = new THREE.Mesh(new THREE.CylinderGeometry(2, 6, 10, 16), dressMat);
    dress.position.y = 10;
    group.add(dress);

    // 頭 (稍微圓一點)
    const head = new THREE.Mesh(new THREE.SphereGeometry(4.5, 32, 16), skinMat);
    head.position.y = 18;
    group.add(head);

    // 頭髮 (雙馬尾版 - 圓潤可愛)
    // 頂部頭髮 (覆蓋頭部避免禿頭)
    const hairTop = new THREE.Mesh(new THREE.SphereGeometry(4.8, 32, 16), hairMat);
    hairTop.position.y = 18.5;
    hairTop.scale.set(1.1, 1, 1.1);
    group.add(hairTop);

    // 瀏海
    const bangs = new THREE.Mesh(new THREE.SphereGeometry(5.0, 32, 16), hairMat);
    bangs.position.y = 19;
    bangs.scale.set(1, 0.45, 1);
    bangs.rotation.x = 0.8;
    group.add(bangs);

    // 雙馬尾
    const ponyTailGeom = new THREE.SphereGeometry(2.5, 16, 16);
    const tieMat = new THREE.MeshPhongMaterial({ color: 0xff6b6b }); // 紅色髮圈

    // 左馬尾
    const ponyL = new THREE.Group();
    const tieL = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1, 16), tieMat);
    tieL.rotation.z = Math.PI / 4;
    ponyL.add(tieL);
    const hairL = new THREE.Mesh(ponyTailGeom, hairMat);
    hairL.scale.set(1, 1.5, 1);
    hairL.position.set(2, -1, 0);
    ponyL.add(hairL);
    ponyL.position.set(4, 20, 0);
    group.add(ponyL);

    // 右馬尾
    const ponyR = new THREE.Group();
    const tieR = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1, 16), tieMat);
    tieR.rotation.z = -Math.PI / 4;
    ponyR.add(tieR);
    const hairR = new THREE.Mesh(ponyTailGeom, hairMat);
    hairR.scale.set(1, 1.5, 1);
    hairR.position.set(-2, -1, 0);
    ponyR.add(hairR);
    ponyR.position.set(-4, 20, 0);
    group.add(ponyR);

    // 臉部細節：眼睛 (大一點，增加神采)
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16), blackMat);
    eye1.position.set(1.8, 18.5, 3.8);
    group.add(eye1);
    const eye2 = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16), blackMat);
    eye2.position.set(-1.8, 18.5, 3.8);
    group.add(eye2);

    // 臉頰 (紅暈)
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xffb6c1, transparent: true, opacity: 0.6 });
    const blush1 = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), blushMat);
    blush1.position.set(3, 17.5, 3.5);
    group.add(blush1);
    const blush2 = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), blushMat);
    blush2.position.set(-3, 17.5, 3.5);
    group.add(blush2);

    // 腿 (穿襪子跟鞋子)
    const legs = [];
    const legGeom = new THREE.CylinderGeometry(1, 0.8, 6, 16);

    const createLeg = (x) => {
        const legGroup = new THREE.Group();
        const leg = new THREE.Mesh(legGeom, skinMat);
        legGroup.add(leg);

        const sock = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2, 16), socksMat);
        sock.position.y = -2;
        legGroup.add(sock);

        const shoe = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.5, 4), shoesMat);
        shoe.position.set(0, -3, 1);
        legGroup.add(shoe);

        legGroup.position.set(x, 3, 0);
        group.add(legGroup);
        legs.push(legGroup);
    };

    createLeg(1.8);
    createLeg(-1.8);

    // 手 (更自然的角度)
    const armGeom = new THREE.CylinderGeometry(0.7, 0.7, 8, 16);
    const armL = new THREE.Mesh(armGeom, skinMat);
    armL.position.set(4.5, 12, 0);
    armL.rotation.z = -0.4;
    group.add(armL);
    const armR = new THREE.Mesh(armGeom, skinMat);
    armR.position.set(-4.5, 12, 0);
    armR.rotation.z = 0.4;
    group.add(armR);

    return { group, legs };
}

// 建立閉合型圍欄 (閉合圈)
function createClosedEnclosure(centerX, centerZ, size) {
    const halfSize = size / 2;
    const fenceWidth = 30; // 每個圍隔的長度
    const numFences = Math.ceil(size / fenceWidth);

    // 紀錄邊界
    farmEnclosures.push({
        xMin: centerX - halfSize,
        xMax: centerX + halfSize,
        zMin: centerZ - halfSize,
        zMax: centerZ + halfSize
    });

    for (let i = 0; i < numFences; i++) {
        // 北邊
        createFence(centerX - halfSize + i * fenceWidth + fenceWidth / 2, centerZ - halfSize, 0);
        // 南邊
        createFence(centerX - halfSize + i * fenceWidth + fenceWidth / 2, centerZ + halfSize, 0);
        // 西邊
        createFence(centerX - halfSize, centerZ - halfSize + i * fenceWidth + fenceWidth / 2, Math.PI / 2);
        // 東邊
        createFence(centerX + halfSize, centerZ - halfSize + i * fenceWidth + fenceWidth / 2, Math.PI / 2);
    }
}

// 數據管理 (強健版 + 診斷)
let lastValidPetsCount = 0;
let lastValidDiariesCount = 0;

function loadData() {
    try {
        const savedPets = localStorage.getItem('pets');
        const savedNotes = localStorage.getItem('notes');
        const savedDiaries = localStorage.getItem('diaries');
        const savedStats = localStorage.getItem('stats');

        console.log("正在從 LocalStorage 載入資料...", {
            protocol: window.location.protocol,
            host: window.location.host,
            hasPets: !!savedPets
        });

        if (savedPets) {
            try {
                const parsed = JSON.parse(savedPets);
                if (Array.isArray(parsed)) {
                    pets = parsed;
                    lastValidPetsCount = pets.length;
                }
            } catch (e) { console.error("Pets 解析失敗"); }
        }

        if (savedNotes) {
            try {
                const parsed = JSON.parse(savedNotes);
                if (Array.isArray(parsed)) notes = parsed;
            } catch (e) { console.error("Notes 解析失敗"); }
        }

        if (savedDiaries) {
            try {
                const parsed = JSON.parse(savedDiaries);
                if (Array.isArray(parsed)) {
                    diaries = parsed;
                    lastValidDiariesCount = diaries.length;
                }
            } catch (e) { console.error("Diaries 解析失敗"); }
        }

        if (savedStats) {
            try {
                const parsed = JSON.parse(savedStats);
                if (parsed && typeof parsed === 'object') stats = { ...stats, ...parsed };
            } catch (e) { console.error("Stats 解析失敗"); }
        }

        // 關鍵修正：確保 stats 的數量與實際陣列一致
        stats.dogs = pets.filter(p => p.type === 'dog').length;
        stats.cats = pets.filter(p => p.type === 'cat').length;
        stats.totalDiaries = diaries.length;

        console.log("資料載入解析成功:", {
            petsCount: pets.length,
            diariesCount: diaries.length
        });
    } catch (e) {
        console.error("LocalStorage 載入失敗或損毀:", e);
    }
}

// 匯出資料
function exportData() {
    const data = { pets, notes, diaries, stats };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pet_farm_backup_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// 匯入資料
function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.pets && data.diaries) {
                    localStorage.setItem('pets', JSON.stringify(data.pets));
                    localStorage.setItem('notes', JSON.stringify(data.notes || []));
                    localStorage.setItem('diaries', JSON.stringify(data.diaries));
                    localStorage.setItem('stats', JSON.stringify(data.stats || stats));
                    alert('匯入成功！網頁即將重新整理...');
                    location.reload();
                } else {
                    alert('檔案格式不正確');
                }
            } catch (err) {
                alert('匯入失敗：' + err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function saveAllData() {
    // 防呆保護：如果原本有資料，但現在變成空的，不允許自動覆蓋
    if (lastValidPetsCount > 0 && pets.length === 0) {
        console.warn("偵測到可能的資料遺失，取消自動存檔以保護舊資料。");
        return;
    }

    localStorage.setItem('pets', JSON.stringify(pets));
    localStorage.setItem('notes', JSON.stringify(notes));
    localStorage.setItem('diaries', JSON.stringify(diaries));
    localStorage.setItem('stats', JSON.stringify(stats));

    // 更新最後驗證數量
    lastValidPetsCount = pets.length;
    lastValidDiariesCount = diaries.length;
}

function addPet(forcedType = null) {
    const type = forcedType || ['dog', 'cat'][Math.floor(Math.random() * 2)];
    const breeds = PET_BREEDS[type];
    const breed = breeds[Math.floor(Math.random() * breeds.length)];

    const newPet = {
        id: Date.now().toString(),
        type: type,
        breed: breed,
        addedAt: new Date().toISOString()
    };
    pets.push(newPet);

    // 同步寵物到雲端
    if (window.dbSync) {
        window.dbSync.savePet(newPet);
    }

    if (type === 'dog') stats.dogs++;
    else stats.cats++;

    add3DPet(breed);
    saveAllData();
    updateUI();

    const emoji = PET_EMOJI[breed] || PET_EMOJI[type];
    alert(`🎉 恭喜獲得 ${BREED_NAMES[breed]} ${emoji}！`);
}

function add3DPet(breed, id = null) {
    const { group, legs, tail, tongue } = createPetModel(breed);
    const hint = createHintSprite();
    group.add(hint);

    let r = Math.random() * 200;
    let theta = Math.random() * Math.PI * 2;
    group.position.set(Math.cos(theta) * r, 0, Math.sin(theta) * r);

    scene.add(group);

    const petObj = {
        id: id || Date.now().toString() + Math.random(), // 確保唯一性
        mesh: group,
        legs: legs,
        tail: tail,
        tongue: tongue,
        hint: hint,
        breed: breed,
        walking: true,
        velocityX: (Math.random() - 0.5) * 1.0,
        velocityZ: (Math.random() - 0.5) * 1.0
    };

    updatePetRotation(petObj);
    petObjects.push(petObj);
}

function saveDiary() {
    const content = diaryContent.value.trim();
    if (!content) { alert('請輸入內容'); return; }

    const type = 'dog'; // 日記獎勵一定是狗
    const breeds = PET_BREEDS[type];
    const breed = breeds[Math.floor(Math.random() * breeds.length)];

    diaries.unshift({
        id: Date.now().toString(),
        content: content,
        createdAt: new Date().toISOString(),
        petReward: breed
    });

    // 獲取最新日記並同步到雲端
    if (window.dbSync) {
        window.dbSync.saveDiary(diaries[0]);
    }

    stats.totalDiaries++;
    addPet(type);
    diaryContent.value = '';
    saveAllData();
    updateUI();
}

function deleteDiary(id) {
    if (!confirm('確定刪除？此日記對應的寵物也會消失喔！')) return;

    // 找到對應的日記，確認獎勵類型
    const entry = diaries.find(d => d.id === id);
    if (entry) {
        removePet(entry.petReward);
    }

    diaries = diaries.filter(d => d.id !== id);
    stats.totalDiaries = diaries.length;
    saveAllData();
    updateUI();
}

function removePet(breed) {
    // 從後往前找，刪除最新的一隻
    for (let i = pets.length - 1; i >= 0; i--) {
        if (pets[i].breed === breed || pets[i].type === breed) {
            const petId = pets[i].id;
            // 1. 從 pets 陣列移除
            pets.splice(i, 1);

            // 2. 從 3D 場景移除
            const objIndex = petObjects.findIndex(obj => obj.id === petId || (obj.breed === breed && obj.walking));
            if (objIndex !== -1) {
                scene.remove(petObjects[objIndex].mesh);
                petObjects.splice(objIndex, 1);
            }

            // 3. 更新統計
            const type = breed === 'munchkin' ? 'cat' : 'dog';
            if (type === 'dog') stats.dogs = Math.max(0, stats.dogs - 1);
            else stats.cats = Math.max(0, stats.cats - 1);

            break;
        }
    }
}

function addNote() {
    const content = noteInput.value.trim();
    if (!content) return;
    notes.push({ id: Date.now().toString(), content });
    noteInput.value = '';
    saveAllData();
    updateUI();
}

function deleteNote(id) {
    if (confirm('確定刪除筆記？對應的貓咪也會消失喔！')) {
        notes = notes.filter(n => n.id !== id);
        removePet('cat'); // 筆記對應的是貓
        saveAllData();
        updateUI();
    }
}

function completeNote(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    // 1. 將內容存入日記歷史 (連動功能)
    diaries.unshift({
        id: Date.now().toString() + "_note",
        content: `[筆記完成] ${note.content}`,
        createdAt: new Date().toISOString(),
        petReward: 'munchkin' // 筆記統一獎勵貓咪
    });

    // 2. 移除筆記
    notes = notes.filter(n => n.id !== id);

    // 3. 獲取獎勵
    addPet('cat');

    // 4. 更新統計與存檔
    stats.totalDiaries = diaries.length;
    saveAllData();
    updateUI();
    alert('筆記已轉存日記，並獎勵一隻貓咪！🐈');
}

function updateUI() {
    dogCount.textContent = stats.dogs;
    catCount.textContent = stats.cats;
    totalNotes.textContent = notes.length;
    totalDiariesEl.textContent = stats.totalDiaries;

    notesList.innerHTML = '';
    notes.forEach(n => {
        const li = document.createElement('li');
        li.className = 'note-item';
        li.innerHTML = `<span>${n.content}</span><div class="note-btns"><button class="btn-complete" onclick="completeNote('${n.id}')">✅</button><button class="btn-delete" onclick="deleteNote('${n.id}')">🗑️</button></div>`;
        notesList.appendChild(li);
    });

    diaryHistory.innerHTML = '';
    diaries.forEach(d => {
        const div = document.createElement('div');
        div.className = 'diary-entry';
        div.innerHTML = `<div class="diary-entry-date">📅 ${new Date(d.createdAt).toLocaleDateString()}<button class="btn-delete-small" onclick="deleteDiary('${d.id}')">🗑️</button></div><div class="diary-entry-content">${d.content}</div>`;
        diaryHistory.appendChild(div);
    });
}

function initApp() {
    try {
        loadData();
        initThreeJS();

        // 如果是新用戶或本地切換，顯示提示
        if (pets.length === 0 && diaries.length === 0) {
            const debug = document.getElementById('debugInfo');
            if (debug) {
                debug.style.display = 'block';
                debug.style.background = '#e3f2fd';
                debug.style.borderColor = '#2196f3';
                debug.style.color = '#0d47a1';
                debug.innerHTML = "💡 偵測到當前網域資料為空。若您有備份檔，請使用下方的「匯入還原」按鈕。";
            }
        }
    } catch (e) {
        window.onerror(e.message, "app.js", 0, 0, e);
    }

    // 兼容舊資料與極致容錯：確保每個寵物都能載入
    pets.forEach(p => {
        const breed = p.breed || p.type || 'shiba';
        const validBreeds = ['shiba', 'corgi', 'munchkin'];
        const finalBreed = validBreeds.includes(breed) ? breed : 'shiba';
        add3DPet(finalBreed, p.id);
    });
    updateUI();

    saveDiaryBtn.addEventListener('click', saveDiary);
    addNoteBtn.addEventListener('click', addNote);
    noteInput.addEventListener('keypress', e => e.key === 'Enter' && addNote());

    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportData);
    if (importBtn) importBtn.addEventListener('click', importData);
}

window.deleteNote = deleteNote;
window.completeNote = completeNote;
window.deleteDiary = deleteDiary;
document.addEventListener('DOMContentLoaded', initApp);

// 建立抓取提示標籤
function createHintSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // 背景 (圓角矩形)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    const xBorder = 0, yBorder = 0, wBorder = 128, hBorder = 64, rBorder = 15;
    ctx.beginPath();
    ctx.moveTo(xBorder + rBorder, yBorder);
    ctx.lineTo(xBorder + wBorder - rBorder, yBorder);
    ctx.quadraticCurveTo(xBorder + wBorder, yBorder, xBorder + wBorder, yBorder + rBorder);
    ctx.lineTo(xBorder + wBorder, yBorder + hBorder - rBorder);
    ctx.quadraticCurveTo(xBorder + wBorder, yBorder + hBorder, xBorder + wBorder - rBorder, yBorder + hBorder);
    ctx.lineTo(xBorder + rBorder, yBorder + hBorder);
    ctx.quadraticCurveTo(xBorder, yBorder + hBorder, xBorder, yBorder + hBorder - rBorder);
    ctx.lineTo(xBorder, yBorder + rBorder);
    ctx.quadraticCurveTo(xBorder, yBorder, xBorder + rBorder, yBorder);
    ctx.closePath();
    ctx.fill();

    // 文字
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('抓我 🤚', 64, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(16, 8, 1);
    sprite.visible = false;
    return sprite;
}
