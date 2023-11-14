import { useRef, useState, useEffect } from "react";
import "./App.css";
import * as tf from "@tensorflow/tfjs";
import * as poseDetection from '@tensorflow-models/pose-detection';

import Webcam from "react-webcam";
// import { drawKeypoints, drawSkeleton } from "./utilities";

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  let extended: boolean = true
  const [counter, setCounter] = useState(0)
  const [HS, setHS] = useState(0)
  const [HL, setHL] = useState(0)

  let count = 0
  
  useEffect(() => {
    tf.ready().then(() => {
      runPose();
    });
  }, []);

  const runPose = async () => {
    const detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet, 
      {modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER}
    );
    setInterval(() => {
      detect(detector);
    }, 150);
  };

  const lengthSquare = (X: number[], Y: number[]): number => { 
    let xDiff: number = X[0] - Y[0]; 
    let yDiff: number = X[1] - Y[1]; 
    return xDiff*xDiff + yDiff*yDiff; 
  } 
  
  const getAngle = (A: number[], B: number[], C: number[]): number => { 
    // Square of lengths a2, b2, c2
    let a2: number = lengthSquare(B,C); 
    let b2: number = lengthSquare(A,C); 
    let c2: number = lengthSquare(A,B); 
  
    // length of sides b, c 
    let b: number = Math.sqrt(b2); 
    let c: number = Math.sqrt(c2); 
  
    // From Cosine law 
    let alpha: number = Math.acos((b2 + c2 - a2)/(2*b*c)); 
  
    // Converting to a degree 
    alpha = alpha * 180 / Math.PI; 
  
    return alpha
  }
  
  const pushup = (leftWrist: any, leftS: any, leftElbow: any, nose: any) => {
      const SE = { x: leftElbow.x - leftS.x, y: leftElbow.y - leftS.y };
      const EW = { x: leftWrist.x - leftElbow.x, y: leftWrist.y - leftElbow.y };
      const angleRadians = Math.acos((SE.x * EW.x + SE.y * EW.y) / (Math.hypot(SE.x, SE.y) * Math.hypot(EW.x, EW.y)))
      let angle = (angleRadians * 180) / Math.PI;

      // or const angle: number = getAngle([leftElbow.x, leftElbow.y], [leftS.x, leftS.y], [leftWrist.x, leftWrist.y])
      
      if (leftWrist.score < 0.3 && leftElbow.score < 0.3 && leftS.score < 0.3) {
        return
      }

      if (angle >= 0 && angle < 95 && extended == true) {
        var msg = new SpeechSynthesisUtterance(String(count+1));
        window.speechSynthesis.speak(msg);
        setCounter(counter => counter + 1) 
        count += 1
        extended = false
      } else if ((angle > 130 && angle <= 180) && extended == false && nose.y > leftElbow.y) {
        extended = true
      }
  }
  
  const squat = (
    leftHip: any, rightHip: any, 
    leftLeg: any, rightLeg: any,
    leftS: any, rightS: any
  ) => {
    if(leftLeg.score < 0.3 || leftHip.score < 0.3 || leftS.score < 0.3) return

    const hl: number = leftLeg.y - leftHip.y; 
    const hs: number = leftHip.y - leftS.y
    
    // leg hip shoulder, bottom to top
    const angle: number = getAngle([leftHip.x, leftHip.y], [leftS.x, leftS.y], [leftLeg.x, leftLeg.y],)
    
    if(hl/hs >= 1.65 && hl/hs <= 2.2 && extended){
      extended = false
      setCounter(counter => counter + 1)
    } else if (hl/hs < 1.65 && extended == false && angle >= 165 && angle <= 205){
      extended = true
    }
  }

  const core = (shoulder: any, hip: any, foot: any) => {
    const SE = { x: hip.x - shoulder.x, y: hip.y - shoulder.y };
    const EW = { x: foot.x - hip.x, y: foot.y - hip.y };
    const angleRadians = Math.acos((SE.x * EW.x + SE.y * EW.y) / (Math.hypot(SE.x, SE.y) * Math.hypot(EW.x, EW.y)))
    let angle = (angleRadians * 180) / Math.PI;
    setCounter(angle)
  }

  // jumpingJack(
  //   poses[0].keypoints[7], poses[0].keypoints[8],
  //   poses[0].keypoints[5], poses[0].keypoints[6],
  //   poses[0].keypoints[15], poses[0].keypoints[16],
  // )

  const jumpingJack = (
    lElbow: any, rElbow: any,
    lShoulder: any, rShoulder: any,
    lFoot: any, rFoot: any
  ) => {
    if(
      lElbow.y > lShoulder.y && rElbow.y > rShoulder.y &&
      (lFoot.x - rFoot.x) < (lShoulder.x - rShoulder.x) &&
      extended
    ) {
      extended = false
      setCounter(counter => counter + 1)
    } else if(
      lElbow.y < lShoulder.y && rElbow.y < rShoulder.y &&
      (lFoot.x - rFoot.x) > (lShoulder.x - rShoulder.x) &&
      extended == false
    ) {
      extended = true
    }
  }

  const plank = (
    foot: any, knee: any, hip: any, shoulder: any
  ) => {
    const kneeAngle: number = getAngle([knee.x, knee.y], [foot.x, foot.y], [hip.x, hip.y])
    const bodyAngle: number = getAngle([hip.x, hip.y], [foot.x, foot.y], [shoulder.x, shoulder.y])
    const bodyAngle2: number = getAngle([shoulder.x, foot.y], [foot.x, foot.y], [shoulder.x, shoulder.y])
    if(
      kneeAngle <= 190 && kneeAngle > 175 && 
      bodyAngle <= 190 && bodyAngle > 175 &&
      bodyAngle2 // calculate while practicing, set the standart
    ){
      // balanced = true
    } else {
      // balanced = false
    }
  }

  let c: number = 0
  let isErr: boolean = false
  let T: any = null
  let left: boolean = false

  const highKnees = (
    lFoot: any, rFoot: any,
    lKnee: any, rKnee: any,
    lWrist: any, rWrist: any,
    lHip: any, rHip: any,
    lShoulder: any, rShoulder: any
  ) => {
    const hl: number = lFoot.y - lHip.y; 
    const hs: number = lHip.y - lShoulder.y
    const angleL: number = getAngle([lHip.x, lHip.y], [lShoulder.x, lShoulder.y], [lFoot.x, lFoot.y])

    const hl2: number = rFoot.y - rHip.y
    const hs2: number = rHip.y - rShoulder.y
    const angleR: number = getAngle([rHip.x, rHip.y], [rShoulder.x, rShoulder.y], [rFoot.x, rFoot.y])
    
    if(((angleL < 160 || angleL > 200) && (angleR < 160 || angleR > 200)) || (hl <= hs && hl2 <= hs2)){
      console.log('stand in the right position')
      if(!isErr){return hkT()}
    } if(
      lWrist.y < lShoulder.y || lWrist.y > lHip.y || rWrist.y < rShoulder.y || rWrist > rHip.y
    ){
      console.log('keep your wrists to your stomach level')
      if(!isErr){return hkT()}
    } 
    if(lKnee.y < rHip.y && left == false){
      left = true
      c++
    } else if(rKnee.y > lHip.y && left){
      left = false
      c++
    } else {
      console.log('move your knees above your hips')
    }
    if(c >= 2){
      clearTimeout(T)
    }
  }

  const hkT = () => {
    isErr = true
    c = 0
    T = setTimeout(() => {
      console.log('Do it again')
    }, 1500)
  }

  

  const detect = async (net: any) => {
    if (
      typeof webcamRef.current !== "undefined" &&
      webcamRef.current !== null &&
      webcamRef.current['video']['readyState'] === 4
    ) {
      const video = webcamRef.current['video'];
      const poses = await net.estimatePoses(video);

      if(!poses || !poses[0]['keypoints']) return
      
      // pushup(poses[0].keypoints[9], poses[0].keypoints[5], poses[0].keypoints[7], poses[0].keypoints[0])
      squat(
        poses[0].keypoints[11], poses[0].keypoints[12], 
        poses[0].keypoints[15], poses[0].keypoints[16],
        poses[0].keypoints[5], poses[0].keypoints[6],
      )
      // core(poses[0].keypoints[5], poses[0].keypoints[11], poses[0].keypoints[15])
  };
  }

  // const drawCanvas = (pose: any, video: any, videoWidth: any, videoHeight: any, canvas: any) => {
  //   const ctx = canvas.current.getContext("2d");
  //   canvas.current.width = videoWidth;
  //   canvas.current.height = videoHeight;

  //   drawKeypoints(pose["keypoints"], 0.6, ctx);
  //   drawSkeleton(pose["keypoints"], 0.7, ctx);
  // };

  return (
    <div className="App">
      <header className="App-header" style={{background: 'var(--background)', padding: '10px'}}>
        <input type="text" placeholder="sa"/>
        <h1>{counter}</h1>
        <Webcam
          ref={webcamRef}
          style={{
            position: "absolute",
            marginLeft: "auto",
            marginRight: "auto",
            left: 0,
            right: 0,
            textAlign: "center",
            zIndex: 9,
            width: 940,
            height: 480,
          }}
        />

        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            marginLeft: "auto",
            marginRight: "auto",
            left: 0,
            right: 0,
            textAlign: "center",
            zIndex: 9,
            width: 640,
            height: 480,
          }}
        />
      </header>
    </div>
  );
}

export default App;