import { Link } from "react-router-dom"
import "./menu.scss"

const StudentMenu = () => {
    return(
        <div className="menu">
            <div className="item">
                <span className="title">STUDENT FUNCTIONS</span>
                <Link to="/play-game" className="listItem">
                <img src="/note.svg" alt="" />
                <span className="ListItemTitle">Play Game</span>
                </Link>
                <Link to="/profile" className="listItem">
                <img src="/profile.svg" alt="" />
                <span className="ListItemTitle">Profile</span>
                </Link>
            </div>
            <div className="item" >
                <span className="title">INFORMATION</span>
                <Link to="/student-announcement" className="listItem">
                <img src="/note.svg" alt="" />
                <span className="ListItemTitle">Announcements</span>
                </Link>
                <Link to="/student-report" className="listItem">
                <img src="/form.svg" alt="" />
                <span className="ListItemTitle">Report</span>
                </Link>
            </div>
            <div className="item" >
                <span className="title">SETTINGS</span>
                <Link to="/student-settings" className="listItem">
                <img src="/settings.svg" alt="" />
                <span className="ListItemTitle">Settings</span>
                </Link>
            </div>
        </div>
    )
}

export default StudentMenu
