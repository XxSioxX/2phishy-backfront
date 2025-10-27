import { Link } from "react-router-dom"
import "./chartBox.scss"
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts"
import { ChartBoxData } from "../../types/data"

interface ChartBoxProps extends ChartBoxData {}

const ChartBox: React.FC<ChartBoxProps> = (props) => {
    return (
        <div className="chartBox">
            <div className="boxInfo">
                <div className="title">
                <img src={props.icon} alt="" className={props.icon === "/person4.svg"|| props.icon === "/wand.svg" ? "userIcon icon" : "icon"}  />
                <span>{props.title}</span>
                </div>
                <h1>{props.number}</h1>
                <Link to="/" style={{color:props.color}}> View all </Link>
            </div>
            <div className="chartInfo">
            <div className="chart">
                <ResponsiveContainer width="99%" height="100%">
                    <LineChart data={props.chartData}>
                        <Tooltip 
                        contentStyle={{background:"transparent", border:"none"}}
                        labelStyle={{display:"none"}}
                        position={{x:20, y:60}}
                        />
                        <Line
                         type="monotone" 
                         dataKey={props.dataKey}
                         stroke={props.color}
                         strokeWidth={2} 
                         dot={false}
                         />
                        </LineChart>
                        </ResponsiveContainer>
            </div>
            <div className="texts">
                <span className="percentage" style={{color: props.percentage<0 ? "tomato": "limegreen"}}>
                    {props.title === "Total Users" ? `+${props.percentage}` : `${props.percentage}%`}
                </span>
                <span className="duration">
                    {props.title === "Total Users" || props.title === "Active Participants Over Time" ? "this week" : "this month"}
                </span>
            </div>
            </div>
        </div>
    )
}

export default ChartBox