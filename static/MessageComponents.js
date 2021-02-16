import React from 'react';

export function SystemMessage({ user, msg }) {
    return (
      <li className="khala-redirection-system">
        <h6>System</h6>
        <div>
          <p>{msg}{user.nickname}</p>
        </div>
      </li>
    )
  }
  
export function UserMessage({ orgUser, msg, targetLanguages, translatedMessages, userConfig, isMe }) {
    function ChatItemAvatar() {
      const image = `/image/avatar/avatar0${orgUser.avatar}.jpg`;
      return (
        <span className="item-avatar">
          <img src={image} />
        </span>
      )
    }
  
    if (isMe) {
      let changeBtns;
      console.log(translatedMessages);
      translatedMessages.forEash(item => {
        changeBtns.push(<li className="item-switch-translation-button">KO</li>);
      })
      return (
        <li className="khala-redirection-item isMe">
          <ChatItemAvatar />
          <h6 className="item-username">{orgUser.nickname}</h6>
          <div className="item-contents">
            <div className="item-frame">
              <p className="item-text active" data-lang="ko">{msg}</p>
            </div>
            <div className="item-switch-wrap">
              <ul className="item-switch-translation">
                <li className="item-switch-translation-button">KO</li>
              </ul>
            </div>
          </div>
        </li>
      )
    } else {
      const translatedMsg = translatedMessages.filter(item => item.type === userConfig.language)[0].msg;
      console.log(userConfig);
      console.log(translatedMsg);
      return (
        <li className="khala-redirection-item">
          <span className="item-avatar">
            <ChatItemAvatar />
          </span>
          <h6 className="item-username">{orgUser.nickname}</h6>
          <div className="item-contents">
            <div className="item-frame">
              <p className="item-text active">{translatedMsg}</p>
              <p className="item-text origin">Temporary.</p>
            </div>
            <div className="item-switch-wrap">
              <div className="item-switch-origin">
                <i className="fas fa-sync-alt"></i> 
              </div>
            </div>
          </div>
        </li>
      )
    }
  }