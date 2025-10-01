import { Link } from "react-router-dom"
import "./menu.scss"

const Menu = () => {
    return(
        <div className="menu">
            <div className="item">
                <span className="title">MAIN FUNCTIONS</span>
                <Link to="/" className="listItem">
                <img src="/home.svg" alt="" />
                <span className="ListItemTitle">Dashboard</span>
                </Link>
                <Link to="/profile" className="listItem">
                <img src="/profile.svg" alt="" />
                <span className="ListItemTitle">Profile</span>
                </Link>
            </div>
            <div className="item" >
                <span className="title">GAME MANAGEMENT</span>
                <Link to="/quiz-insights" className="listItem">
                <img src="/note.svg" alt="" />
                <span className="ListItemTitle">Quiz Insights</span>
                </Link>
                <Link to="/announcement" className="listItem">
                <img src="/note.svg" alt="" />
                <span className="ListItemTitle">Announcement</span>
                </Link>
                <Link to="/posts" className="listItem">
                <img src="post2.svg" alt="" />
                <span className="ListItemTitle">Posts</span>
                </Link>
                {/* Play Game entry */}
                <Link to="/play-game" className="listItem">
                <img src="/note.svg" alt="" />
                <span className="ListItemTitle">Play Game</span>
                </Link>
            </div>
            <div className="item" >
                <span className="title">SECURITY & MONITORING</span>
                <Link to="/users" className="listItem">
                <img src="/user.svg" alt="" />
                <span className="ListItemTitle">Users</span>
                </Link>
                <Link to="/report" className="listItem">
                <img src="/form.svg" alt="" />
                <span className="ListItemTitle">Reports</span>
                </Link>
                <Link to="/settings" className="listItem">
                <img src="/settings.svg" alt="" />
                <span className="ListItemTitle">Settings</span>
                </Link>
            </div>
        </div>
    )
}

export default Menu