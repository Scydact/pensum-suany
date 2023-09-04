import { useNavigate } from "react-router-dom";

function AppFooter() {
  const navigate = useNavigate();

  return <footer className="my-3 navbar navbar-expand navbar-light static-bottom text-center">
    <span>Suany Rosario, Fernando Rivas, 2023</span>
    <span>
      <a
        href="http://scydact.github.io/"
        target="_blank"
        rel="noreferrer">
        scydact.github.io
      </a>
      <span style={{ margin: '0 .5rem' }}>
        (<a
          href="https://github.com/Scydact/pensum-suany"
          target="_blank"
          rel="noreferrer">
          Ver en GitHub
        </a>)
      </span>
    </span>
    <span>Version v{process.env.REACT_APP_VERSION} | save v{process.env.REACT_APP_SAVE_VERSION}</span>
    <span>
      En caso de problemas o sugerencias,
      favor escribir a <a
        href="mailto:suanyelizabeth@gmail.com?subject=[Pensum UASD]">
        scydact@gmail.com</a>
      <span
       className="muted" 
       onClick={() => navigate("debug")}
       title="Debug">
        .
      </span>
    </span>
  </footer>
}

export default AppFooter;