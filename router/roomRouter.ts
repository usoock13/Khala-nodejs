import express from 'express';
const router = express.Router();
const request = require('request');

import { User, UserConfig } from './User';
import { Room } from './Room';
import { Papago } from './papago';
import { PapagoNow } from './papago-now';

let isDeadPapago = false;

function CreateRoom(): string /* 방번호 */ {
    let myRoom = new Room();
    // 생성된 방의 roomNumber를 반환
    
    // 대입된 roomNumber를 반환
    return myRoom.GetRoomNumber();
}

// /room GET 통신 Router >>
router.get('/', (req: any, res: any) => {
    res.render('room', {
        cookie: req.headers.cookie
    });
})
router.post('/', (req: any, res: any) => {
    res.render('room', {
        cookie: req.headers.cookie
    });
})

const iconv = require('iconv-lite');
// room.ejs와 socket통신하는 모든 처리를 통괄
const RoomSocket = (io: any) => {
    const rs = io.of('/room');
    // 사용자가 모두 퇴장할 경우 해당 방을 등록할 변수. 지연시간동안 새로운 유저가 입장할 경우 방 파괴를 취소
    let roomsWatingForDestroy: any[] = [];
    rs.on('connection', (socket: any) =>{
        // User Info (khala-config) 요청
        socket.emit('require:userinfo', socket.id);
        
        // 사용자(Client)가 Usre info 요청에 정상적으로 응답하였을 경우, 입창 처리 핸들러
        socket.on('send:userinfo', (data: string) => {
            if(!JSON.parse(JSON.parse(data).userConfig)) return;
            let userConfig: UserConfig = {
                ...JSON.parse(JSON.parse(data).userConfig),
                session: socket.id
            }
            // 사용자가 보낸 방 번호(url의 parameter)로 방을 검색
            let targetRoom = Room.GetRoomForRoomNumber(JSON.parse(data).roomNumber);
            socket.join(JSON.parse(data).roomNumber);
            
            // 방 번호로 검색한 결과, 해당하는 방이 있을 경우
            if(targetRoom){
                targetRoom.AddUser(new User(userConfig));
                targetRoom.lastChatUser = new User();
                rs.to(targetRoom.roomNumber).emit('user:enter', targetRoom.users, userConfig);
                roomsWatingForDestroy.forEach(item => {
                    if (item.roomNumber === targetRoom.roomNumber) clearTimeout(item.timeout)
                })
                console.log(`User Connected to ${targetRoom.roomNumber} room.`)
            } else {
                socket.emit('not-exist-room');
            }
        });

        // 사용자 연결 끊김 이벤트 핸들러 >>
        socket.on('disconnect', () => {
            let exitUser: User = User.allUsers.filter(user => user.session === socket.id)[0];
            let roomsNumberForRemove = Room.GetRoomForUser(exitUser);
            // 방에서 사용자를 제거. 큰일이 있지 않은 이상 반환된 배열의 길이는 1일 것.
            roomsNumberForRemove.forEach(room => {
                // 방에서 exitUser에 해당하는 User를 제거
                room.RemoveUser(exitUser.session);
                // socket.io의 room에서도 해당 세션을 제거
                socket.leave(room.roomNumber);
                // 방에 남은 유저와 나간 유저를 남은 사용자들에게 전달
                rs.to(room.roomNumber).emit('response:user-leave', room.users, exitUser);
                console.log(`User disconnected from ${room.roomNumber} room.`);
                // 방에 남은 인원이 없을 경우
                if(room.users.length <=0){
                    // 잠깐의 지연시간을 가진 뒤 해당 방을 제거
                    const DELAY_TO_DESTROY = 5000;
                    const destroyTimeout = setTimeout(() => {
                        Room.RemoveRoom(room.roomNumber);
                    }, DELAY_TO_DESTROY);
                    roomsWatingForDestroy.push({ timeout: destroyTimeout, roomNumber: room.roomNumber });
                }
            })
        })

        // 사용자가 보낸 메세지 처리 핸들러 >>
        socket.on('send:user-message', async (msg: string) => {
            const user: any = User.GetUserForSession(socket.id);
            if(user){
                // 메세지를 전송한 사용자의 정보를 바탕으로 해당 메세지가 전송된 방을 반환함
                const room : Room = Room.GetRoomForUser(user)[0];
                // 방에 접속한 유저들이 사용하는 언어들의 목록을 반환하는 메서드 > GetLanguageTypes
                const targetLanguages = room.GetLanguageTypes();
                
                // 각  
                let translatedMsg: any = await Translate(user, msg, targetLanguages);

                // 전송할 데이터의 Payload. 원래의 메세지와 유저, 번역된 메세지(들)와 대상 언어(들)가 탑재.
                const payload = {
                    orgMsg: msg,
                    orgUser: user,
                    targetLanguages: targetLanguages,
                    translatedMessages: translatedMsg,
                    isSuccessive: room.lastChatUser.session === user.session
                }
                
                // 같은 방에 있는 사용자에게 메세지 전송
                room.lastChatUser = user;
                rs.to(room.roomNumber).emit('response:user-message', user, payload);
            } else {
                console.error('This user is who? Not found this man.');
            }
        })
    })
}

function Translate(orgUser: User, orgMsg: string, langTypes: Array<string>) {
    return new Promise(async (resolve) => {
        let array: any = [];
        for(const lang of langTypes){
            if (lang !== orgUser.language) {
                // Papago REST API가 정상 작동 중일 경우
                if(!isDeadPapago){
                    const params = {
                        sourceLang: orgUser.language,
                        targetLang: lang,
                        query: orgMsg
                    }
                    // Papago REST API 실행
                    await Papago(params)
                    .then((res: any) => {
                        if(res instanceof Error){
                            throw(res);
                        }
                        const parsingRes = JSON.parse(res).message.result;
                        array.push({ type: parsingRes.tarLangType, msg: parsingRes.translatedText });
                    })
                    .catch(async err => { // Papago REST API에서 Error 발생
                        console.error(err);
                        // Papago REST API의 상태를 비정상으로 지정 (isDeadPapago)
                        // 이후 REST API 실행 차단 및 대체코드 실행
                        isDeadPapago = true;
                        // PapagoNow를 초기화, 이후 대체코드에서는 translate() 메서드만 실행
                        // (puppeteer 브라우저 실행)
                        await PapagoNow().init();
                    });
                }
                // Error를 발생시킨 요청도 처리하기 위해 if else가 아닌 if, if로 처리
                // Papago REST API 상태가 비정상으로 판단되는 경우
                if(isDeadPapago) {
                    const params = {
                        so: orgUser.language,
                        ta: lang,
                        text: orgMsg
                    }
                    await PapagoNow().translate(params)
                    .then((res : any) => {
                        const parsingRes = JSON.parse(res);
                        array.push({ 
                            type: parsingRes.tarLangType, 
                            msg: parsingRes.translatedText
                        });
                    })
                }
            }
        }
        resolve(array);
    })
}

// 번역 REST API 통신
/* 
function PapagoNow(params: any){
    request.post({
        headers: {
            "Content-Type": "application/json",
        },
        url: "https://papago-now.herokuapp.com/translate",
        body: {
            "so": params.so,
            "ta": params.ta,
            "text": params.text
        },
        json: true
    }, function(error: any, res: any, body: Body) {
        if(error){
            console.error(error);
        }
        console.dir("res : " + res);
        console.log("body : " + body)
    })
}
*/

module.exports = {
    router: router,
    RoomSocket: RoomSocket,
    CreateRoom: CreateRoom,
};