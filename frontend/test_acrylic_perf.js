import { run } from './src/effects/acrylic/acrylic.js';

async function test() {
    let strokePath = [];
    for(let i=0; i<3000; i++) {
        strokePath.push([Math.floor(Math.random()*800), Math.floor(Math.random()*600)]);
    }

    let params = {
        stroke_input: {
            image_rgba: {
                width: 800,
                height: 600,
                data: new Uint8ClampedArray(800 * 600 * 4)
            },
            path: strokePath
        },
        user_input: {
            Radius: 20,
            'Blur Edges': false,
            Alpha: 1.0,
            Color: '#FF0000'
        }
    };

    console.time("acrylicRun");
    let result = await run(params, p => console.log(p));
    console.timeEnd("acrylicRun");
}
test().catch(console.error);
