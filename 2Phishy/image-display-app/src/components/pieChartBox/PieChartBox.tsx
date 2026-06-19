import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import "./pieChartBox.scss";

interface PieChartBoxItem {
    name: string;
    value: number;
    color: string;
}

interface PieChartBoxProps {
    title: string;
    icon: string;
    data: PieChartBoxItem[];
}

const defaultData: PieChartBoxItem[] = [
    { name: "Excellent", value: 40, color: "#4CAF50" },
    { name: "Good", value: 35, color: "#FFB74D" },
    { name: "Needs Improvement", value: 25, color: "#E57373" },
];

const PieChartBox: React.FC<PieChartBoxProps> = ({
    title,
    icon,
    data = defaultData,
}) => {
    return (
        <div className="pieChartBox">
             <div className="title">
             <img src={icon} alt="" />
            <h1>{title}</h1>
            </div>
            <div className="chart">
                <ResponsiveContainer width="99%" height={300}>
                    <PieChart>
                        <Tooltip
                            contentStyle={{background:"var(--soft-bg)", borderRadius:"5px", border: "1px solid var(--dark-color)"}} />
                        <Pie
                        data={data}
                        innerRadius={"70%"}
                        outerRadius={"90%"}
                        paddingAngle={5}
                        dataKey="value"
                        >
                            {data.map((item) => (
                                <Cell 
                                key={item.name} 
                                fill={item.color} />
          ))}
        </Pie>
        </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="options">
                {data.map((item)=> (
                    <div className="option" key={item.name}>
                    <div className="title">
                        <div className="dot" style={{backgroundColor:item.color}}/>
                          <span>{item.name}</span>  
                        </div>
                        <span>{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default PieChartBox;