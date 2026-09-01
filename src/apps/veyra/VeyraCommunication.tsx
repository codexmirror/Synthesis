import { useGameState } from '../../app/GameContext'

/** The represented Company Chat on Petra's phone; presentation owns no copy of its history. */
export function VeyraCommunication() {
  const chat = useGameState().petraCompanyChat
  return <section className="veyra-screen veyra-communication" aria-label="Communication">
    <header className="veyra-communication__head">
      <p className="veyra-eyebrow">VEYRA</p>
      <h1 className="veyra-title">Communication</h1>
    </header>
    <div className="veyra-company-chat" aria-label={chat.name}>
      <h2>{chat.name}</h2>
      {chat.messages.length === 0
        ? <p className="veyra-company-chat__empty">No messages yet.</p>
        : chat.messages.map((message) => <article className="veyra-company-message" key={message.id}>
          <strong>{message.authorName}</strong>
          <p>{message.body}</p>
        </article>)}
    </div>
  </section>
}
