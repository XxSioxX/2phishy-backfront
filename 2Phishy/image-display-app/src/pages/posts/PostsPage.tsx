import { postsMockData, PostMockData } from "../../data";
import "./PostsPage.scss";

const PostsPage = () => {
  return (
    <div className="posts-page">
      <div className="headerWithButton">
        <h2>Posts</h2>
        <div className="action-buttons">
          <button className="action-btn">Add</button>
          <button className="action-btn">Delete</button>
          <button className="action-btn">Edit</button>
        </div>
      </div>
      <table className="posts-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Category</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {postsMockData.map((row: PostMockData, idx: number) => (
            <tr key={idx}>
              <td>{row.title}</td>
              <td>{row.category}</td>
              <td>{row.status}</td>
              <td>{row.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PostsPage; 