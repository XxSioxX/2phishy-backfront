import {
  createBrowserRouter,
  RouterProvider,
  Outlet
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TimezoneProvider } from "./contexts/TimezoneContext";
import RouteGuard from "./components/RouteGuard";
import Footer from "./components/footer/Footer";
import Menu from "./components/menu/Menu";
import Navbar from "./components/navbar/Navbar";
import Home from "./pages/Home Admin/Home";
import Login from "./pages/login/Login";
import Register from "./pages/register/Register";
import AnnouncementPage from "./pages/announcement/AnnouncementPage";
import "./styles/global.scss";
import ReportPage from "./pages/report/ReportPage";
import Settings from "./pages/settings/Settings";
import QuizInsightsPage from "./pages/quizInsights/QuizInsightsPage";
import PostsPage from "./pages/posts/PostsPage";
import Users from "./pages/users/Users";
import AbadiaPage from "./pages/game/AbadiaPage";
import Profile from "./pages/profile/Profile";
import StudentMenu from "./components/menu/StudentMenu";
import StudentSettings from "./pages/student-settings/StudentSettings";
import StudentReport from "./pages/student-report/StudentReport";
import StudentAnnouncement from "./pages/student-announcement/StudentAnnouncement";
import DateTimeDisplay from "./components/DateTimeDisplay/DateTimeDisplay";

const App: React.FC = () => {
  const Layout: React.FC = () => {
    const { user } = useAuth();
    const isStudent = user?.role === 'student';
    
    return (
      <div className="main">
        <Navbar/>
        <div className="container">
          <div className="menuContainer">
            {isStudent ? <StudentMenu/> : <Menu/>}
            <DateTimeDisplay/>
          </div>
          <div className="contentContainer">
            <Outlet/>
          </div>
        </div>
        <Footer/>
      </div>
    );
  };

  const router = createBrowserRouter([
    {
      path: "/",
      element: <Layout/>,
      children: [
        {
          path: "/",
          element: <RouteGuard allowedRoles={['admin', 'super-admin']}><Home/></RouteGuard>
        },
        {
          path: "/users",
          element: <RouteGuard allowedRoles={['admin', 'super-admin']}><Users /></RouteGuard>
        },
        {
          path: "/announcement",
          element: <RouteGuard allowedRoles={['admin', 'super-admin']}><AnnouncementPage/></RouteGuard>
        },
        {
          path: "/report",
          element: <RouteGuard allowedRoles={['admin', 'super-admin']}><ReportPage /></RouteGuard>
        },
        {
          path: "/settings",
          element: <RouteGuard allowedRoles={['admin', 'super-admin']}><Settings /></RouteGuard>
        },
        {
          path: "/quiz-insights",
          element: <RouteGuard allowedRoles={['admin', 'super-admin']}><QuizInsightsPage /></RouteGuard>
        },
        {
          path: "/posts",
          element: <RouteGuard allowedRoles={['admin', 'super-admin']}><PostsPage /></RouteGuard>
        },
        {
          path: "/play-game",
          element: <AbadiaPage />
        },
        {
          path: "/admin",
          element: <RouteGuard allowedRoles={['admin', 'super-admin']}><Users /></RouteGuard>
        },
        {
          path: "/profile",
          element: <Profile />
        },
        {
          path: "/student-settings",
          element: <RouteGuard allowedRoles={['student']}><StudentSettings /></RouteGuard>
        },
        {
          path: "/student-report",
          element: <RouteGuard allowedRoles={['student']}><StudentReport /></RouteGuard>
        },
        {
          path: "/student-announcement",
          element: <RouteGuard allowedRoles={['student']}><StudentAnnouncement /></RouteGuard>
        }
      ]
    },
    {
      path: "/login",
      element: <Login />
    },
    {
      path: "/register",
      element: <Register />
    }
  ]);

  return (
    <AuthProvider>
      <TimezoneProvider>
        <RouterProvider router={router} />
      </TimezoneProvider>
    </AuthProvider>
  );
};

export default App; 
