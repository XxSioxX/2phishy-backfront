
import BarChartBox from "../../components/barChartBox/BarChartBox"
import ChartBox from "../../components/chartBox/ChartBox"
import TopBox from "../../components/topBox/TopBox"
import PieChartBox from "../../components/pieChartBox/PieChartBox"
import { barChartBoxVisit, chartBoxActiveParticipants, chartBoxQuizRate, chartBoxUser } from "../../data"
import "./home.scss"
import BigChartBox from "../../components/bigChartBox/BigChartBox"

const Home = () => {
    return(
        <div className="home">
            <div className="box box1">
                <TopBox/>
            </div>
            <div className="box box2"><ChartBox {...chartBoxUser}/></div>
            <div className="box box3"><ChartBox {...chartBoxQuizRate}/></div>
            <div className="box box4"><PieChartBox/></div>
            <div className="box box5"><ChartBox {...chartBoxActiveParticipants}/></div>
            <div className="box box6"><BarChartBox {...barChartBoxVisit}/> </div>
            <div className="box box7"><BigChartBox /></div>

        </div>
    )
}

export default Home